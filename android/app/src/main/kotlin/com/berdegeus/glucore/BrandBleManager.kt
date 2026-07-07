package com.berdegeus.glucore

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.ActivityCompat
import tk.glucodata.Natives
import java.util.UUID

/**
 * Brand-agnostic BLE session manager: scanning, connection lifecycle,
 * GATT write queue, reconnect backoff and glucose emission are shared;
 * each sensor brand supplies its GATT protocol through the abstract hooks.
 *
 * All state is confined to the main thread — GATT callbacks arrive on
 * binder threads and are posted to the main looper before touching state.
 */
abstract class BrandBleManager(
    protected val context: Context,
    private val onEvent: (Map<String, Any?>) -> Unit
) : BluetoothGattCallback() {

    companion object {
        private const val SCAN_TIMEOUT_MS = 30_000L
        private const val CONNECT_TIMEOUT_MS = 20_000L
        private const val CONNECT_AFTER_SCAN_DELAY_MS = 350L
        private const val CONNECT_RETRY_DELAY_MS = 1_000L
        private const val MAX_CONNECT_RETRIES = 3
        private const val HISTORY_SYNC_SETTLE_MS = 2_000L
        private const val CURRENT_READING_MAX_AGE_MS = 20 * 60 * 1000L

        // Backoff for automatic reconnection after an unexpected disconnect
        // (30 s → 2 min → 5 min, capped at the last step).
        private val RECONNECT_BACKOFF_MS = longArrayOf(30_000L, 120_000L, 300_000L)

        protected val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    }

    protected abstract val tag: String

    /** Human-readable brand name used in user-facing error messages. */
    protected abstract val brandName: String

    /** Service UUID advertised by the sensor, used as the scan filter. */
    protected abstract val scanServiceUuid: UUID

    private val bluetoothManager = context.getSystemService(BluetoothManager::class.java)
    private val bluetoothAdapter: BluetoothAdapter? get() = bluetoothManager?.adapter
    protected val mainHandler = Handler(Looper.getMainLooper())

    protected var dataptr: Long = 0L
        private set
    protected var currentGatt: BluetoothGatt? = null
        private set
    protected var pendingDevice: BluetoothDevice? = null
        private set

    // Set by the subclass once its characteristics are bound; gates the
    // write queue and the connect timeout ("connected but never set up").
    protected var setupComplete = false

    private var scanCallback: ScanCallback? = null
    private var isScanning = false
    private var disconnectRunnable: Runnable? = null
    private var scanTimeoutRunnable: Runnable? = null
    private var connectTimeoutRunnable: Runnable? = null
    private var connectRunnable: Runnable? = null
    private var connectRetryCount = 0
    private var reconnectRunnable: Runnable? = null
    private var reconnectAttempt = 0
    private var didRescanAfterFailure = false
    protected var isStopping = false
        private set
    private var historySyncActive = false
    private var historyReadingsReceived = 0
    protected var lastSyncedTimestampMs: Long? = null
        private set
    private var pendingCurrentCandidate: DecodedGlucoseReading? = null
    private var settleCurrentRunnable: Runnable? = null
    protected var hasDeliveredCurrentReading = false
        private set
    private var latestDeliveredReadingTimestampMs: Long? = null
    private var latestDeliveredReadingTimestampReliable = false

    // GATT write queue — connection-scoped, main-thread-only (no locks needed).
    private class PendingWrite(val characteristic: BluetoothGattCharacteristic, val bytes: ByteArray)

    private val writeQueue = ArrayDeque<PendingWrite>()
    private var writeInFlight = false
    private var lastWrite: PendingWrite? = null
    private var lastWriteRetried = false

    private val isDebugBuild =
        (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    protected fun assertMainThread() {
        if (isDebugBuild) {
            check(Looper.myLooper() == Looper.getMainLooper()) {
                "$tag state must only be touched on the main thread"
            }
        }
    }

    fun hasBlePermissions(): Boolean =
        ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
        ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    // ── Brand hooks ───────────────────────────────────────────────────────────

    /**
     * Called after scan state is reset with [dataptr] already set; the brand
     * loads whatever it needs to match/authenticate (device suffix, serial).
     * Returning failure aborts the scan.
     */
    protected open fun prepareScan(): Result<Unit> = Result.success(Unit)

    /** Whether an advertised device name belongs to the active sensor. */
    protected abstract fun matchDevice(deviceName: String): Boolean

    /** Persist the matched device so restore can skip scanning. */
    protected open fun persistMatchedDevice(device: BluetoothDevice) {
        try {
            Natives.setDeviceAddress(dataptr, device.address)
        } catch (e: Exception) {
            Log.w(tag, "setDeviceAddress: ${e.message}")
        }
    }

    /** Invoked on GATT connection, before service discovery starts. */
    protected open fun onBrandConnected(gatt: BluetoothGatt) {}

    /**
     * Return false to defer service discovery (e.g. while OS bonding is in
     * progress); the subclass is then responsible for calling
     * `gatt.discoverServices()` once it is ready.
     */
    protected open fun shouldDiscoverServicesOnConnect(gatt: BluetoothGatt): Boolean = true

    /** Invoked after successful service discovery; bind characteristics here. */
    protected abstract fun onBrandServicesDiscovered(gatt: BluetoothGatt)

    /** Invoked after a CCCD descriptor write completes (any status). */
    protected abstract fun onBrandDescriptorWrite(characteristicUuid: UUID, status: Int)

    /** Invoked for every notification/indication, on the main thread. */
    protected abstract fun onBrandCharacteristicChanged(uuid: UUID, data: ByteArray, timestampMs: Long)

    /** Invoked after a characteristic read completes, on the main thread. */
    protected open fun onBrandCharacteristicRead(uuid: UUID, value: ByteArray?, status: Int) {}

    /** Invoked after a queued characteristic write succeeds. */
    protected open fun onBrandCharacteristicWrite(uuid: UUID, status: Int) {}

    /** Invoked when the connection is torn down; clear brand-local state. */
    protected open fun onBrandDisconnected() {}

    /**
     * Invoked with the GATT status when an established connection drops,
     * before the generic disconnect handling (e.g. Libre 2 uses status 19
     * right after enabling notifications to reset its native BLE state).
     */
    protected open fun onBrandConnectionLost(status: Int) {}

    // ── Scan / connect lifecycle ──────────────────────────────────────────────

    fun startSensorScan(dataptr: Long): Result<Unit> {
        // Explicit (user-initiated) start: drop any pending automatic
        // reconnect and restart the backoff progression from scratch.
        cancelReconnect()
        reconnectAttempt = 0
        return startSensorScan(dataptr, preferSavedAddress = true, resetFailureState = true)
    }

    private fun startSensorScan(
        dataptr: Long,
        preferSavedAddress: Boolean,
        resetFailureState: Boolean
    ): Result<Unit> {
        if (!hasBlePermissions()) return Result.failure(Exception("BLE permissions not granted"))
        val adapter = bluetoothAdapter ?: return Result.failure(Exception("Bluetooth not available"))
        if (!adapter.isEnabled) return Result.failure(Exception("Bluetooth is off"))
        if (isScanning) return Result.failure(Exception("Scan already in progress"))

        this.dataptr = dataptr
        this.isStopping = false
        this.connectRetryCount = 0
        if (resetFailureState) {
            this.didRescanAfterFailure = false
        }
        this.pendingDevice = null
        resetReadingSyncState()
        clearWriteQueue()
        cancelPendingConnect()
        cancelConnectTimeout()
        cancelDisconnectTimer()
        currentGatt?.close()
        currentGatt = null
        setupComplete = false
        onBrandDisconnected()

        prepareScan().onFailure { return Result.failure(it) }

        val savedAddress = try { Natives.getDeviceAddress(dataptr, false) } catch (e: Exception) {
            Log.w(tag, "getDeviceAddress(false) failed: ${e.message}")
            null
        }
        if (
            preferSavedAddress &&
            !savedAddress.isNullOrBlank() &&
            BluetoothAdapter.checkBluetoothAddress(savedAddress)
        ) {
            val savedDevice = adapter.getRemoteDevice(savedAddress)
            Log.i(tag, "Using saved device address first: $savedAddress")
            connectToDevice(savedDevice, "saved address", delayMs = 0L)
            return Result.success(Unit)
        }

        val scanner = adapter.bluetoothLeScanner ?: return Result.failure(Exception("LE scanner unavailable"))
        val filters = listOf(
            ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(scanServiceUuid))
                .build()
        )

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanCallback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val name = result.device.name ?: return
                if (matchDevice(name)) {
                    Log.i(tag, "Matched device: $name (${result.device.address})")
                    stopScan()
                    connectToDevice(result.device, "scan match", delayMs = CONNECT_AFTER_SCAN_DELAY_MS)
                }
            }
            override fun onScanFailed(errorCode: Int) {
                Log.e(tag, "Scan failed: $errorCode")
                stopScan()
                emitError("BLE scan failed (code $errorCode)")
            }
        }

        scanner.startScan(filters, settings, scanCallback!!)
        isScanning = true
        emitStatus("scanning")

        scanTimeoutRunnable = Runnable {
            if (isScanning) {
                stopScan()
                if (reconnectAttempt > 0 && !isStopping) {
                    // Automatic reconnect cycle: keep retrying with backoff
                    // instead of ending on a terminal error.
                    emitStatus("disconnected")
                    scheduleReconnect()
                } else {
                    emitError("No $brandName device found (timeout)")
                }
            }
        }.also { mainHandler.postDelayed(it, SCAN_TIMEOUT_MS) }

        return Result.success(Unit)
    }

    fun stopScan() {
        cancelScanTimeout()
        if (!isScanning) return
        if (hasBlePermissions()) {
            bluetoothAdapter?.bluetoothLeScanner?.stopScan(scanCallback)
        }
        scanCallback = null
        isScanning = false
    }

    open fun disconnect() {
        isStopping = true
        cancelReconnect()
        reconnectAttempt = 0
        cancelDisconnectTimer()
        cancelPendingConnect()
        cancelConnectTimeout()
        stopScan()
        currentGatt?.let {
            if (hasBlePermissions()) it.disconnect()
            it.close()
        }
        currentGatt = null
        setupComplete = false
        pendingDevice = null
        connectRetryCount = 0
        dataptr = 0L
        resetReadingSyncState()
        clearWriteQueue()
        onBrandDisconnected()
    }

    // ── GATT callbacks ────────────────────────────────────────────────────────
    //
    // GATT callbacks arrive on binder threads. Each override copies what it
    // needs from the callback parameters and posts the actual handling to the
    // main looper, so all manager state stays confined to the main thread.

    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        mainHandler.post { handleConnectionStateChange(gatt, status, newState) }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
        mainHandler.post { handleServicesDiscovered(gatt, status) }
    }

    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
        val characteristicUuid = descriptor.characteristic.uuid
        mainHandler.post { handleDescriptorWrite(characteristicUuid, status) }
    }

    // Legacy notification callback (< API 33). The stack reuses the value
    // buffer, so it must be copied before posting. On API 33+ the framework
    // invokes the three-argument overload below instead.
    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        if (Build.VERSION.SDK_INT >= 33) return
        val uuid = characteristic.uuid
        val data = characteristic.value?.copyOf() ?: return
        val timestamp = System.currentTimeMillis()
        mainHandler.post { handleCharacteristicChanged(uuid, data, timestamp) }
    }

    // API 33+ notification callback; `value` is already a stable copy.
    override fun onCharacteristicChanged(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        value: ByteArray
    ) {
        val uuid = characteristic.uuid
        val timestamp = System.currentTimeMillis()
        mainHandler.post { handleCharacteristicChanged(uuid, value, timestamp) }
    }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onCharacteristicRead(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        status: Int
    ) {
        if (Build.VERSION.SDK_INT >= 33) return
        val uuid = characteristic.uuid
        val value = characteristic.value?.copyOf()
        mainHandler.post { onBrandCharacteristicRead(uuid, value, status) }
    }

    override fun onCharacteristicRead(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        value: ByteArray,
        status: Int
    ) {
        val uuid = characteristic.uuid
        mainHandler.post { onBrandCharacteristicRead(uuid, value, status) }
    }

    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
        val uuid = characteristic.uuid
        mainHandler.post { handleCharacteristicWrite(uuid, status) }
    }

    // ── Main-thread GATT handlers ─────────────────────────────────────────────

    private fun handleConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        assertMainThread()
        when (newState) {
            BluetoothProfile.STATE_CONNECTED -> {
                Log.i(tag, "GATT connected, discovering services")
                cancelDisconnectTimer()
                cancelConnectTimeout()
                cancelReconnect()
                reconnectAttempt = 0
                connectRetryCount = 0
                didRescanAfterFailure = false
                pendingDevice = gatt.device
                gatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH)
                onBrandConnected(gatt)
                if (!shouldDiscoverServicesOnConnect(gatt)) {
                    return
                }
                if (!hasBlePermissions() || !gatt.discoverServices()) {
                    Log.e(tag, "discoverServices() failed")
                    emitError("Service discovery could not start")
                    gatt.close()
                }
            }
            BluetoothProfile.STATE_DISCONNECTED -> {
                Log.i(tag, "GATT disconnected (status=$status)")
                onBrandConnectionLost(status)
                cancelDisconnectTimer()
                cancelConnectTimeout()
                gatt.close()
                if (currentGatt === gatt) {
                    currentGatt = null
                }
                currentGatt = null
                setupComplete = false
                clearWriteQueue()
                onBrandDisconnected()

                if (!isStopping && handleConnectionFailure(gatt.device, status)) {
                    return
                }
                emitStatus("disconnected")
                if (!isStopping) {
                    // Unexpected disconnect (or exhausted immediate retries):
                    // keep trying in the background with increasing backoff.
                    scheduleReconnect()
                }
            }
        }
    }

    private fun handleServicesDiscovered(gatt: BluetoothGatt, status: Int) {
        assertMainThread()
        if (status != BluetoothGatt.GATT_SUCCESS) {
            Log.e(tag, "Service discovery failed: $status")
            emitError("Service discovery failed ($status)")
            disconnect()
            return
        }
        onBrandServicesDiscovered(gatt)
    }

    private fun handleDescriptorWrite(characteristicUuid: UUID, status: Int) {
        assertMainThread()
        onBrandDescriptorWrite(characteristicUuid, status)
    }

    private fun handleCharacteristicChanged(uuid: UUID, data: ByteArray, timestamp: Long) {
        assertMainThread()
        onBrandCharacteristicChanged(uuid, data, timestamp)
    }

    private fun handleCharacteristicWrite(uuid: UUID, status: Int) {
        assertMainThread()
        writeInFlight = false
        if (status != BluetoothGatt.GATT_SUCCESS) {
            lastWrite?.let { retryOrFailWrite(it, "status $status") }
            return
        }
        lastWrite = null
        lastWriteRetried = false
        onBrandCharacteristicWrite(uuid, status)
        drainWriteQueue()
    }

    // ── Connection helpers ────────────────────────────────────────────────────

    private fun connectToDevice(device: BluetoothDevice, reason: String, delayMs: Long) {
        pendingDevice = device
        persistMatchedDevice(device)
        emitStatus("connecting")

        if (!hasBlePermissions()) {
            emitError("BLE permissions lost")
            return
        }

        currentGatt?.close()
        currentGatt = null
        setupComplete = false
        cancelPendingConnect()
        cancelConnectTimeout()

        connectRunnable = Runnable {
            connectRunnable = null
            if (isStopping || dataptr == 0L) {
                return@Runnable
            }
            Log.i(tag, "Connecting to ${device.address} (${device.name ?: "unknown"}) via $reason")
            currentGatt = device.connectGatt(context, false, this, BluetoothDevice.TRANSPORT_LE)
            scheduleConnectTimeout()
        }.also { mainHandler.postDelayed(it, delayMs) }
    }

    protected fun restartConnection(reason: String) {
        val device = pendingDevice ?: currentGatt?.device
        if (device == null) {
            emitError("Unable to reconnect: no BLE device available")
            return
        }

        if (currentGatt != null) {
            currentGatt?.close()
            currentGatt = null
        }
        setupComplete = false
        resetReadingSyncState()
        clearWriteQueue()
        cancelPendingConnect()
        cancelConnectTimeout()
        onBrandDisconnected()
        connectToDevice(device, reason, delayMs = CONNECT_RETRY_DELAY_MS)
    }

    // ── Notification / descriptor helpers ─────────────────────────────────────

    /**
     * Enables notifications (or indications) on [characteristic] and writes
     * its CCCD. Returns false when any step fails to start; the confirmation
     * arrives in [onBrandDescriptorWrite].
     */
    protected fun enableCharacteristicNotification(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        indication: Boolean = false
    ): Boolean {
        if (!hasBlePermissions() || !gatt.setCharacteristicNotification(characteristic, true)) {
            return false
        }
        val cccd = characteristic.getDescriptor(CCCD_UUID) ?: return false
        val value = if (indication) {
            BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
        } else {
            BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        }
        return if (Build.VERSION.SDK_INT >= 33) {
            gatt.writeDescriptor(cccd, value) == BluetoothStatusCodes.SUCCESS
        } else {
            legacyWriteDescriptor(gatt, cccd, value)
        }
    }

    @Suppress("DEPRECATION")
    private fun legacyWriteDescriptor(
        gatt: BluetoothGatt,
        descriptor: BluetoothGattDescriptor,
        value: ByteArray
    ): Boolean {
        descriptor.value = value
        return gatt.writeDescriptor(descriptor)
    }

    /** Starts a characteristic read; result arrives in [onBrandCharacteristicRead]. */
    protected fun readCharacteristic(characteristic: BluetoothGattCharacteristic): Boolean {
        val gatt = currentGatt ?: return false
        if (!hasBlePermissions()) return false
        return gatt.readCharacteristic(characteristic)
    }

    // ── Glucose emission (shared history-sync → current promotion flow) ──────

    protected fun decodePackedGlucose(
        packedReading: Long,
        timestampMs: Long,
        source: String,
        hasReliableSensorTimestamp: Boolean
    ): DecodedGlucoseReading? {
        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = packedReading,
            timestampMs = timestampMs,
            hasReliableSensorTimestamp = hasReliableSensorTimestamp
        )
        if (decoded == null) {
            val glucoseTenths = packedReading and 0xFFFFFFFFL
            if (glucoseTenths == 0L) {
                Log.w(tag, "$source returned glucose=0 for packed value $packedReading")
            } else {
                Log.w(tag, "$source returned implausible glucose payload $packedReading (tenths=$glucoseTenths)")
            }
            return null
        }

        Log.i(
            tag,
            "Decoded glucose from $source: ${decoded.mgdl} mg/dL rate=${decoded.rate} alarm=${decoded.alarmCode}"
        )
        return decoded
    }

    /**
     * Routes a decoded reading through the shared backlog flow: while no
     * current reading has been delivered yet, readings are treated as history
     * back-fill (emitting `syncingHistory` progress) and the most recent one
     * is promoted to current after the stream settles.
     */
    protected fun deliverReading(decoded: DecodedGlucoseReading) {
        if (hasDeliveredCurrentReading) {
            if (shouldPublishReading(decoded)) {
                emitGlucoseReading(decoded)
            }
            return
        }

        historySyncActive = true
        historyReadingsReceived += 1
        lastSyncedTimestampMs = decoded.timestampMs
        pendingCurrentCandidate = decoded
        emitHistorySyncProgress(decoded)
        scheduleCurrentPromotionIfRecent(decoded)
    }

    /**
     * Marks one history record as received without a decodable reading
     * (e.g. the native layer stored a back-fill record internally) and
     * emits `syncingHistory` progress while no current reading exists.
     */
    protected fun notifyHistoryStored() {
        if (hasDeliveredCurrentReading) return
        historySyncActive = true
        historyReadingsReceived += 1
        emitHistorySyncProgress()
    }

    protected fun completeHistorySyncAndEmit(reading: DecodedGlucoseReading) {
        if (!shouldPublishReading(reading)) {
            return
        }
        emitGlucoseReading(reading)
    }

    protected fun isRecentEnoughForCurrent(timestampMs: Long): Boolean {
        return timestampMs >= System.currentTimeMillis() - CURRENT_READING_MAX_AGE_MS
    }

    private fun emitGlucoseReading(reading: DecodedGlucoseReading) {
        historySyncActive = false
        pendingCurrentCandidate = reading
        hasDeliveredCurrentReading = true
        latestDeliveredReadingTimestampMs = reading.timestampMs
        latestDeliveredReadingTimestampReliable = reading.hasReliableSensorTimestamp
        cancelCurrentPromotion()
        onEvent(mapOf(
            "status" to "readingAvailable",
            "connected" to true,
            "sync" to null,
            "reading" to mapOf(
                "value" to reading.mgdl,
                "timestampMs" to reading.timestampMs,
                "rate" to reading.rate,
                "alarmCode" to reading.alarmCode
            ),
            "historyReading" to null,
            "session" to null,
            "warmup" to null,
            "failure" to null
        ))
    }

    private fun emitHistorySyncProgress(reading: DecodedGlucoseReading? = null) {
        onEvent(mapOf(
            "status" to "syncingHistory",
            "connected" to true,
            "sync" to mapOf(
                "receivedCount" to historyReadingsReceived,
                "latestTimestampMs" to lastSyncedTimestampMs
            ),
            "historyReading" to reading?.let {
                mapOf(
                    "value" to it.mgdl,
                    "timestampMs" to it.timestampMs,
                    "rate" to it.rate,
                    "alarmCode" to it.alarmCode
                )
            },
            "reading" to null,
            "session" to null,
            "warmup" to null,
            "failure" to null
        ))
    }

    private fun scheduleCurrentPromotionIfRecent(reading: DecodedGlucoseReading) {
        cancelCurrentPromotion()
        if (!isRecentEnoughForCurrent(reading.timestampMs)) {
            return
        }

        settleCurrentRunnable = Runnable {
            settleCurrentRunnable = null
            if (hasDeliveredCurrentReading) {
                return@Runnable
            }
            val candidate = pendingCurrentCandidate ?: return@Runnable
            Log.i(tag, "History sync settled; promoting latest synced glucose to current")
            completeHistorySyncAndEmit(candidate)
        }.also { mainHandler.postDelayed(it, HISTORY_SYNC_SETTLE_MS) }
    }

    private fun shouldPublishReading(reading: DecodedGlucoseReading): Boolean {
        val previousTimestamp = latestDeliveredReadingTimestampMs
        if (previousTimestamp != null && reading.timestampMs + 1_000L < previousTimestamp) {
            if (!latestDeliveredReadingTimestampReliable || !reading.hasReliableSensorTimestamp) {
                return true
            }
            Log.i(
                tag,
                "Ignoring out-of-order glucose reading ${reading.mgdl} mg/dL at ${reading.timestampMs}; latest=$previousTimestamp"
            )
            return false
        }
        return true
    }

    private fun resetReadingSyncState() {
        historySyncActive = false
        historyReadingsReceived = 0
        lastSyncedTimestampMs = null
        pendingCurrentCandidate = null
        hasDeliveredCurrentReading = false
        latestDeliveredReadingTimestampMs = null
        latestDeliveredReadingTimestampReliable = false
        cancelCurrentPromotion()
    }

    private fun cancelCurrentPromotion() {
        settleCurrentRunnable?.let { mainHandler.removeCallbacks(it) }
        settleCurrentRunnable = null
    }

    // ── GATT write queue ──────────────────────────────────────────────────────
    //
    // BluetoothGatt only supports a single outstanding write; payloads are
    // queued per target characteristic and the next one is dispatched from
    // onCharacteristicWrite. All queue state is main-thread-only.

    protected fun enqueueWrite(characteristic: BluetoothGattCharacteristic?, bytes: ByteArray?): Boolean {
        assertMainThread()
        if (characteristic == null) { Log.w(tag, "enqueueWrite: no target characteristic"); return false }
        if (bytes == null) { Log.w(tag, "enqueueWrite: null bytes"); return false }
        writeQueue.addLast(PendingWrite(characteristic, bytes))
        drainWriteQueue()
        return true
    }

    private fun drainWriteQueue() {
        assertMainThread()
        if (writeInFlight) return
        val gatt = currentGatt ?: return
        if (!setupComplete) return
        if (!hasBlePermissions()) return
        val payload = writeQueue.removeFirstOrNull() ?: return
        if (payload !== lastWrite) {
            lastWriteRetried = false
        }
        lastWrite = payload
        writeInFlight = true
        if (!dispatchWrite(gatt, payload.characteristic, payload.bytes)) {
            writeInFlight = false
            retryOrFailWrite(payload, "dispatch rejected")
        }
    }

    private fun retryOrFailWrite(payload: PendingWrite, cause: String) {
        assertMainThread()
        if (!lastWriteRetried) {
            lastWriteRetried = true
            Log.w(tag, "Characteristic write failed ($cause); retrying once")
            writeQueue.addFirst(payload)
            drainWriteQueue()
            return
        }
        Log.e(tag, "Characteristic write failed twice ($cause); disconnecting")
        emitError("BLE write failed ($cause)")
        disconnect()
    }

    private fun dispatchWrite(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        bytes: ByteArray
    ): Boolean {
        return if (Build.VERSION.SDK_INT >= 33) {
            gatt.writeCharacteristic(characteristic, bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) ==
                BluetoothStatusCodes.SUCCESS
        } else {
            legacyWriteCharacteristic(gatt, characteristic, bytes)
        }
    }

    @Suppress("DEPRECATION")
    private fun legacyWriteCharacteristic(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        bytes: ByteArray
    ): Boolean {
        characteristic.value = bytes
        return gatt.writeCharacteristic(characteristic)
    }

    private fun clearWriteQueue() {
        writeQueue.clear()
        writeInFlight = false
        lastWrite = null
        lastWriteRetried = false
    }

    // ── Event emission ────────────────────────────────────────────────────────

    protected fun emitEvent(event: Map<String, Any?>) {
        onEvent(event)
    }

    protected fun emitStatus(status: String) {
        onEvent(mapOf(
            "status" to status,
            "connected" to (status == "connected"),
            "session" to null,
            "warmup" to null,
            "reading" to null,
            "failure" to null
        ))
    }

    protected fun emitError(message: String) {
        Log.e(tag, "Error: $message")
        onEvent(mapOf(
            "status" to "error",
            "connected" to false,
            "session" to null,
            "warmup" to null,
            "reading" to null,
            "failure" to mapOf("message" to message)
        ))
    }

    // ── Timers / retries ──────────────────────────────────────────────────────

    protected fun scheduleDisconnect(delayMs: Long, reason: String) {
        cancelDisconnectTimer()
        disconnectRunnable = Runnable {
            Log.w(tag, "Scheduled disconnect: $reason")
            disconnect()
        }.also { mainHandler.postDelayed(it, delayMs) }
    }

    private fun scheduleConnectTimeout() {
        cancelConnectTimeout()
        connectTimeoutRunnable = Runnable {
            if (currentGatt != null && !setupComplete) {
                Log.e(tag, "Connection timeout")
                if (reconnectAttempt > 0 && !isStopping) {
                    // Automatic reconnect cycle: release the pending GATT and
                    // retry later with backoff instead of tearing everything
                    // down (disconnect() would cancel the retry chain).
                    currentGatt?.close()
                    currentGatt = null
                    clearWriteQueue()
                    onBrandDisconnected()
                    emitStatus("disconnected")
                    scheduleReconnect()
                } else {
                    emitError("Connection timeout")
                    disconnect()
                }
            }
        }.also { mainHandler.postDelayed(it, CONNECT_TIMEOUT_MS) }
    }

    // ── Reconnect with backoff ────────────────────────────────────────────────
    //
    // After an unexpected disconnect (not user-initiated, immediate GATT-133
    // retries exhausted) a rescan/reconnect is scheduled on the main handler
    // with increasing delays (30 s → 2 min → 5 min, capped). The backoff is
    // reset on a successful connection or an explicit startSensorScan, and
    // cancelled by disconnect()/stop.

    private fun scheduleReconnect() {
        assertMainThread()
        if (isStopping || dataptr == 0L) return
        cancelReconnect()
        val delayMs = RECONNECT_BACKOFF_MS[minOf(reconnectAttempt, RECONNECT_BACKOFF_MS.size - 1)]
        reconnectAttempt += 1
        Log.i(tag, "Scheduling reconnect attempt #$reconnectAttempt in ${delayMs / 1000}s")
        reconnectRunnable = Runnable {
            reconnectRunnable = null
            if (isStopping || dataptr == 0L) return@Runnable
            Log.i(tag, "Reconnect attempt #$reconnectAttempt")
            startSensorScan(dataptr, preferSavedAddress = true, resetFailureState = true)
                .onFailure {
                    Log.w(tag, "Reconnect scan failed to start: ${it.message}")
                    scheduleReconnect()
                }
        }.also { mainHandler.postDelayed(it, delayMs) }
    }

    private fun cancelReconnect() {
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = null
    }

    private fun cancelScanTimeout() {
        scanTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        scanTimeoutRunnable = null
    }

    private fun cancelConnectTimeout() {
        connectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        connectTimeoutRunnable = null
    }

    private fun cancelPendingConnect() {
        connectRunnable?.let { mainHandler.removeCallbacks(it) }
        connectRunnable = null
    }

    private fun cancelDisconnectTimer() {
        disconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        disconnectRunnable = null
    }

    private fun handleConnectionFailure(device: BluetoothDevice, status: Int): Boolean {
        if (status == BluetoothGatt.GATT_SUCCESS) {
            return false
        }

        if (status == 133 && connectRetryCount < MAX_CONNECT_RETRIES) {
            connectRetryCount += 1
            Log.w(
                tag,
                "GATT 133 on ${device.address}; retrying ${connectRetryCount}/$MAX_CONNECT_RETRIES"
            )
            connectToDevice(device, "gatt-133-retry-$connectRetryCount", delayMs = CONNECT_RETRY_DELAY_MS)
            return true
        }

        if (status == 133 && !didRescanAfterFailure) {
            didRescanAfterFailure = true
            connectRetryCount = 0
            Log.w(tag, "GATT 133 persisted; restarting filtered scan")
            startSensorScan(dataptr, preferSavedAddress = false, resetFailureState = false)
            return true
        }

        emitError("BLE connection failed ($status)")
        return false
    }
}

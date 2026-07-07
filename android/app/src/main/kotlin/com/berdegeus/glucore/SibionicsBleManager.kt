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

class SibionicsBleManager(
    private val context: Context,
    private val onEvent: (Map<String, Any?>) -> Unit
) : BluetoothGattCallback() {

    companion object {
        private const val TAG = "SibionicsBleManager"

        private val SERVICE_UUID = UUID.fromString("0000ff30-0000-1000-8000-00805f9b34fb")
        private val NOTIFY_UUID  = UUID.fromString("0000ff31-0000-1000-8000-00805f9b34fb")
        private val WRITE_UUID   = UUID.fromString("0000ff32-0000-1000-8000-00805f9b34fb")
        private val CCCD_UUID    = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

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
    }

    private val bluetoothManager = context.getSystemService(BluetoothManager::class.java)
    private val bluetoothAdapter: BluetoothAdapter? get() = bluetoothManager?.adapter
    private val mainHandler = Handler(Looper.getMainLooper())

    private var dataptr: Long = 0L
    private var currentGatt: BluetoothGatt? = null
    private var writeChar: BluetoothGattCharacteristic? = null
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
    private var isStopping = false
    private var currentBluetoothNum: String? = null
    private var pendingDevice: BluetoothDevice? = null
    private var historySyncActive = false
    private var historyReadingsReceived = 0
    private var lastSyncedTimestampMs: Long? = null
    private var pendingCurrentCandidate: DecodedGlucoseReading? = null
    private var settleCurrentRunnable: Runnable? = null
    private var hasDeliveredCurrentReading = false
    private var latestDeliveredReadingTimestampMs: Long? = null
    private var latestDeliveredReadingTimestampReliable = false

    // GATT write queue — connection-scoped, main-thread-only (no locks needed).
    private val writeQueue = ArrayDeque<ByteArray>()
    private var writeInFlight = false
    private var lastWrite: ByteArray? = null
    private var lastWriteRetried = false

    private val isDebugBuild =
        (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    private fun assertMainThread() {
        if (isDebugBuild) {
            check(Looper.myLooper() == Looper.getMainLooper()) {
                "SibionicsBleManager state must only be touched on the main thread"
            }
        }
    }

    fun hasBlePermissions(): Boolean =
        ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
        ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

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
        writeChar = null

        val bluetoothNum = try { Natives.getSiBluetoothNum(dataptr) } catch (e: Exception) {
            Log.e(TAG, "getSiBluetoothNum failed: ${e.message}")
            return Result.failure(Exception("Failed to get BLE device identifier: ${e.message}"))
        }
        currentBluetoothNum = bluetoothNum
        Log.i(TAG, "Scanning for device with suffix: $bluetoothNum")

        val savedAddress = try { Natives.getDeviceAddress(dataptr, false) } catch (e: Exception) {
            Log.w(TAG, "getDeviceAddress(false) failed: ${e.message}")
            null
        }
        if (
            preferSavedAddress &&
            !savedAddress.isNullOrBlank() &&
            BluetoothAdapter.checkBluetoothAddress(savedAddress)
        ) {
            val savedDevice = adapter.getRemoteDevice(savedAddress)
            Log.i(TAG, "Using saved device address first: $savedAddress")
            connectToDevice(savedDevice, "saved address", delayMs = 0L)
            return Result.success(Unit)
        }

        val scanner = adapter.bluetoothLeScanner ?: return Result.failure(Exception("LE scanner unavailable"))
        val filters = listOf(
            ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(SERVICE_UUID))
                .build()
        )

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanCallback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val name = result.device.name ?: return
                if (matchDevice(name, bluetoothNum)) {
                    Log.i(TAG, "Matched device: $name (${result.device.address})")
                    stopScan()
                    connectToDevice(result.device, "scan match", delayMs = CONNECT_AFTER_SCAN_DELAY_MS)
                }
            }
            override fun onScanFailed(errorCode: Int) {
                Log.e(TAG, "Scan failed: $errorCode")
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
                    emitError("No Sibionics device found (timeout)")
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

    fun disconnect() {
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
        writeChar = null
        pendingDevice = null
        currentBluetoothNum = null
        connectRetryCount = 0
        dataptr = 0L
        resetReadingSyncState()
        clearWriteQueue()
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
        mainHandler.post { handleDescriptorWrite(status) }
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

    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
        mainHandler.post { handleCharacteristicWrite(status) }
    }

    // ── Main-thread GATT handlers ─────────────────────────────────────────────

    private fun handleConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        assertMainThread()
        when (newState) {
            BluetoothProfile.STATE_CONNECTED -> {
                Log.i(TAG, "GATT connected, discovering services")
                cancelDisconnectTimer()
                cancelConnectTimeout()
                cancelReconnect()
                reconnectAttempt = 0
                connectRetryCount = 0
                didRescanAfterFailure = false
                pendingDevice = gatt.device
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    gatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH)
                }
                try { Natives.EverSenseClear(dataptr) } catch (e: Exception) {
                    Log.w(TAG, "EverSenseClear failed (non-fatal): ${e.message}")
                }
                if (!hasBlePermissions() || !gatt.discoverServices()) {
                    Log.e(TAG, "discoverServices() failed")
                    emitError("Service discovery could not start")
                    gatt.close()
                }
            }
            BluetoothProfile.STATE_DISCONNECTED -> {
                Log.i(TAG, "GATT disconnected (status=$status)")
                cancelDisconnectTimer()
                cancelConnectTimeout()
                gatt.close()
                if (currentGatt === gatt) {
                    currentGatt = null
                }
                currentGatt = null
                writeChar = null
                clearWriteQueue()

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
            Log.e(TAG, "Service discovery failed: $status")
            emitError("Service discovery failed ($status)")
            disconnect()
            return
        }

        val service = gatt.getService(SERVICE_UUID)
        if (service == null) {
            Log.e(TAG, "Sibionics service ff30 not found")
            emitError("Sibionics service not found on device")
            disconnect()
            return
        }

        val notifyChar = service.getCharacteristic(NOTIFY_UUID)
        val wChar = service.getCharacteristic(WRITE_UUID)
        if (notifyChar == null || wChar == null) {
            Log.e(TAG, "Required characteristics ff31/ff32 not found")
            emitError("Required BLE characteristics not found")
            disconnect()
            return
        }
        writeChar = wChar

        if (!hasBlePermissions() || !gatt.setCharacteristicNotification(notifyChar, true)) {
            emitError("Failed to enable notifications")
            disconnect()
            return
        }

        val cccd = notifyChar.getDescriptor(CCCD_UUID)
        if (cccd == null) {
            emitError("CCCD descriptor not found")
            disconnect()
            return
        }
        val wrote = if (!hasBlePermissions()) {
            false
        } else if (Build.VERSION.SDK_INT >= 33) {
            gatt.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) ==
                BluetoothStatusCodes.SUCCESS
        } else {
            legacyWriteDescriptor(gatt, cccd)
        }
        if (!wrote) {
            emitError("Failed to write CCCD descriptor")
            disconnect()
        }
        Log.i(TAG, "Notifications enabled, waiting for descriptor write confirmation")
    }

    private fun handleDescriptorWrite(status: Int) {
        assertMainThread()
        if (status != BluetoothGatt.GATT_SUCCESS) {
            Log.e(TAG, "Descriptor write failed: $status")
            emitError("Failed to enable notifications ($status)")
            disconnect()
            return
        }

        val notChinese = try { Natives.siNotchinese(dataptr) } catch (e: Exception) {
            Log.e(TAG, "siNotchinese failed: ${e.message}")
            false
        }
        Log.i(
            TAG,
            "siNotchinese=$notChinese — ${
                if (notChinese) "sending auth bootstrap"
                else "sending ask-new-data bootstrap"
            }"
        )

        if (notChinese) {
            val authBytes = try { Natives.siAuthBytes(dataptr) } catch (e: Exception) {
                Log.e(TAG, "siAuthBytes failed: ${e.message}")
                null
            }
            if (authBytes == null) {
                emitError("siAuthBytes returned null — check dataptr and sensor registration")
                disconnect()
                return
            }

            Log.i(TAG, "Sending auth bytes (${authBytes.size} bytes)")
            if (!enqueueWrite(authBytes)) {
                emitError("Failed to write auth bytes")
                disconnect()
                return
            }
        } else {
            val askBytes = try { Natives.siAsknewdata(dataptr) } catch (e: Exception) {
                Log.e(TAG, "siAsknewdata bootstrap failed: ${e.message}")
                null
            }
            if (askBytes == null) {
                emitError("siAsknewdata returned null during bootstrap")
                disconnect()
                return
            }

            Log.i(TAG, "Sending ask-new-data bytes (${askBytes.size} bytes)")
            if (!enqueueWrite(askBytes)) {
                emitError("Failed to write initial sensor request")
                disconnect()
                return
            }
        }
        emitStatus("connected")
    }

    private fun handleCharacteristicChanged(uuid: UUID, data: ByteArray, timestamp: Long) {
        assertMainThread()
        if (uuid != NOTIFY_UUID) return

        val code = try {
            Natives.SIprocessData(dataptr, data, timestamp)
        } catch (e: Exception) {
            Log.e(TAG, "SIprocessData threw: ${e.message}")
            return
        }

        Log.d(TAG, "SIprocessData code=$code")

        when (code) {
            1L -> handleGlucoseReady()
            4L -> {
                Log.i(TAG, "code 4: re-authenticate")
                try { Natives.siAuthBytes(dataptr)?.let { enqueueWrite(it) } } catch (e: Exception) {
                    Log.e(TAG, "siAuthBytes on re-auth: ${e.message}")
                }
            }
            5L -> {
                Log.i(TAG, "code 5: time sync")
                try { enqueueWrite(Natives.getSItimecmd()) } catch (e: Exception) {
                    Log.e(TAG, "getSItimecmd: ${e.message}")
                }
            }
            6L -> {
                Log.i(TAG, "code 6: activation")
                try { enqueueWrite(Natives.getSIActivation()) } catch (e: Exception) {
                    Log.e(TAG, "getSIActivation: ${e.message}")
                }
            }
            7L -> {
                Log.i(TAG, "code 7: ask new data")
                try { Natives.siAsknewdata(dataptr)?.let { enqueueWrite(it) } } catch (e: Exception) {
                    Log.e(TAG, "siAsknewdata: ${e.message}")
                }
            }
            8L, 9L -> Unit
            10L -> {
                Log.i(TAG, "code 10: reset")
                try { enqueueWrite(Natives.getSIResetBytes()) } catch (e: Exception) {
                    Log.e(TAG, "getSIResetBytes: ${e.message}")
                }
            }
            2L -> scheduleDisconnect(30_000L, "code 2: invalid frame")
            3L -> {
                Log.w(TAG, "code 3: retry — reconnecting")
                restartConnection("native-code-3")
            }
            else -> {
                // Only attempt to interpret an unknown code as a packed reading
                // once the history sync has produced a timestamp; otherwise an
                // unexpected vendor return value could masquerade as glucose.
                if (lastSyncedTimestampMs != null) {
                    handleDirectGlucoseResult(code, timestamp)
                } else {
                    Log.w(TAG, "Ignoring unknown SIprocessData code $code (no history sync in progress)")
                }
            }
        }
    }

    private fun handleCharacteristicWrite(status: Int) {
        assertMainThread()
        writeInFlight = false
        if (status != BluetoothGatt.GATT_SUCCESS) {
            lastWrite?.let { retryOrFailWrite(it, "status $status") }
            return
        }
        lastWrite = null
        lastWriteRetried = false
        drainWriteQueue()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun matchDevice(deviceName: String, bluetoothNum: String): Boolean {
        val savedName = try { Natives.siGetDeviceName(dataptr) } catch (e: Exception) {
            Log.w(TAG, "siGetDeviceName failed: ${e.message}")
            null
        }
        if (!savedName.isNullOrBlank() && deviceName == savedName) {
            return true
        }
        if (deviceName.length < 4 || bluetoothNum.length < 4) return false
        return bluetoothNum.regionMatches(0, deviceName, deviceName.length - 4, 4)
    }

    private fun connectToDevice(device: BluetoothDevice, reason: String, delayMs: Long) {
        pendingDevice = device
        try {
            Natives.siSaveDeviceName(dataptr, device.name ?: "")
            Natives.setDeviceAddress(dataptr, device.address)
        } catch (e: Exception) {
            Log.w(TAG, "siSaveDeviceName/setDeviceAddress: ${e.message}")
        }
        emitStatus("connecting")

        if (!hasBlePermissions()) {
            emitError("BLE permissions lost")
            return
        }

        currentGatt?.close()
        currentGatt = null
        writeChar = null
        cancelPendingConnect()
        cancelConnectTimeout()

        connectRunnable = Runnable {
            connectRunnable = null
            if (isStopping || dataptr == 0L) {
                return@Runnable
            }
            Log.i(TAG, "Connecting to ${device.address} (${device.name ?: "unknown"}) via $reason")
            currentGatt = device.connectGatt(context, false, this, BluetoothDevice.TRANSPORT_LE)
            scheduleConnectTimeout()
        }.also { mainHandler.postDelayed(it, delayMs) }
    }

    private fun handleGlucoseReady() {
        val readings = try { Natives.getlastGlucose() } catch (e: Exception) {
            Log.e(TAG, "getlastGlucose: ${e.message}")
            null
        }

        if (readings == null || readings.isEmpty()) {
            Log.w(TAG, "getlastGlucose returned null/empty")
            return
        }

        Log.d(TAG, "getlastGlucose raw: ${readings.toList()}")

        val timestampMs = SibionicsGlucoseDecoder.normalizeTimestampMs(
            rawTimestamp = readings.firstOrNull(),
            fallbackTimestampMs = System.currentTimeMillis()
        )
        val packedReading = if (readings.size >= 2) readings[1] else readings[0]
        val decoded = decodePackedGlucose(
            packedReading = packedReading,
            timestampMs = timestampMs,
            source = "getlastGlucose",
            hasReliableSensorTimestamp = true
        )
        if (decoded == null) {
            return
        }

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

    private fun handleDirectGlucoseResult(result: Long, timestampMs: Long) {
        var decoded = decodePackedGlucose(
            packedReading = result,
            timestampMs = timestampMs,
            source = "SIprocessData",
            hasReliableSensorTimestamp = false
        )
        if (decoded == null) {
            Log.w(TAG, "Unhandled SIprocessData result: $result")
            return
        }

        val syncedTimestampMs = lastSyncedTimestampMs
        if (!hasDeliveredCurrentReading &&
            syncedTimestampMs != null &&
            isRecentEnoughForCurrent(syncedTimestampMs)
        ) {
            decoded = decoded.copy(
                timestampMs = syncedTimestampMs,
                hasReliableSensorTimestamp = true
            )
        }

        completeHistorySyncAndEmit(decoded)
    }

    private fun decodePackedGlucose(
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
                Log.w(TAG, "$source returned glucose=0 for packed value $packedReading")
            } else {
                Log.w(TAG, "$source returned implausible glucose payload $packedReading (tenths=$glucoseTenths)")
            }
            return null
        }

        Log.i(
            TAG,
            "Decoded glucose from $source: ${decoded.mgdl} mg/dL rate=${decoded.rate} alarm=${decoded.alarmCode}"
        )
        return decoded
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
            Log.i(TAG, "History sync settled; promoting latest synced glucose to current")
            completeHistorySyncAndEmit(candidate)
        }.also { mainHandler.postDelayed(it, HISTORY_SYNC_SETTLE_MS) }
    }

    private fun isRecentEnoughForCurrent(timestampMs: Long): Boolean {
        return timestampMs >= System.currentTimeMillis() - CURRENT_READING_MAX_AGE_MS
    }

    private fun completeHistorySyncAndEmit(reading: DecodedGlucoseReading) {
        if (!shouldPublishReading(reading)) {
            return
        }
        emitGlucoseReading(reading)
    }

    private fun shouldPublishReading(reading: DecodedGlucoseReading): Boolean {
        val previousTimestamp = latestDeliveredReadingTimestampMs
        if (previousTimestamp != null && reading.timestampMs + 1_000L < previousTimestamp) {
            if (!latestDeliveredReadingTimestampReliable || !reading.hasReliableSensorTimestamp) {
                return true
            }
            Log.i(
                TAG,
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
    // queued and the next one is dispatched from onCharacteristicWrite. All
    // queue state is main-thread-only, so no locks are needed.

    private fun enqueueWrite(bytes: ByteArray?): Boolean {
        assertMainThread()
        if (bytes == null) { Log.w(TAG, "enqueueWrite: null bytes"); return false }
        writeQueue.addLast(bytes)
        drainWriteQueue()
        return true
    }

    private fun drainWriteQueue() {
        assertMainThread()
        if (writeInFlight) return
        val gatt = currentGatt ?: return
        val characteristic = writeChar ?: return
        if (!hasBlePermissions()) return
        val payload = writeQueue.removeFirstOrNull() ?: return
        if (payload !== lastWrite) {
            lastWriteRetried = false
        }
        lastWrite = payload
        writeInFlight = true
        if (!dispatchWrite(gatt, characteristic, payload)) {
            writeInFlight = false
            retryOrFailWrite(payload, "dispatch rejected")
        }
    }

    private fun retryOrFailWrite(payload: ByteArray, cause: String) {
        assertMainThread()
        if (!lastWriteRetried) {
            lastWriteRetried = true
            Log.w(TAG, "Characteristic write failed ($cause); retrying once")
            writeQueue.addFirst(payload)
            drainWriteQueue()
            return
        }
        Log.e(TAG, "Characteristic write failed twice ($cause); disconnecting")
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

    @Suppress("DEPRECATION")
    private fun legacyWriteDescriptor(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor): Boolean {
        descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        return gatt.writeDescriptor(descriptor)
    }

    private fun clearWriteQueue() {
        writeQueue.clear()
        writeInFlight = false
        lastWrite = null
        lastWriteRetried = false
    }

    private fun emitStatus(status: String) {
        onEvent(mapOf(
            "status" to status,
            "connected" to (status == "connected"),
            "session" to null,
            "warmup" to null,
            "reading" to null,
            "failure" to null
        ))
    }

    private fun emitError(message: String) {
        Log.e(TAG, "Error: $message")
        onEvent(mapOf(
            "status" to "error",
            "connected" to false,
            "session" to null,
            "warmup" to null,
            "reading" to null,
            "failure" to mapOf("message" to message)
        ))
    }

    private fun scheduleDisconnect(delayMs: Long, reason: String) {
        cancelDisconnectTimer()
        disconnectRunnable = Runnable {
            Log.w(TAG, "Scheduled disconnect: $reason")
            disconnect()
        }.also { mainHandler.postDelayed(it, delayMs) }
    }

    private fun scheduleConnectTimeout() {
        cancelConnectTimeout()
        connectTimeoutRunnable = Runnable {
            if (currentGatt != null && writeChar == null) {
                Log.e(TAG, "Connection timeout")
                if (reconnectAttempt > 0 && !isStopping) {
                    // Automatic reconnect cycle: release the pending GATT and
                    // retry later with backoff instead of tearing everything
                    // down (disconnect() would cancel the retry chain).
                    currentGatt?.close()
                    currentGatt = null
                    writeChar = null
                    clearWriteQueue()
                    emitStatus("disconnected")
                    scheduleReconnect()
                } else {
                    emitError("Connection timeout")
                    disconnect()
                }
            }
        }.also { mainHandler.postDelayed(it, CONNECT_TIMEOUT_MS) }
    }

    private fun restartConnection(reason: String) {
        val device = pendingDevice ?: currentGatt?.device
        if (device == null) {
            emitError("Unable to reconnect: no BLE device available")
            return
        }

        if (currentGatt != null) {
            currentGatt?.close()
            currentGatt = null
        }
        writeChar = null
        resetReadingSyncState()
        clearWriteQueue()
        cancelPendingConnect()
        cancelConnectTimeout()
        connectToDevice(device, reason, delayMs = CONNECT_RETRY_DELAY_MS)
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
        Log.i(TAG, "Scheduling reconnect attempt #$reconnectAttempt in ${delayMs / 1000}s")
        reconnectRunnable = Runnable {
            reconnectRunnable = null
            if (isStopping || dataptr == 0L) return@Runnable
            Log.i(TAG, "Reconnect attempt #$reconnectAttempt")
            startSensorScan(dataptr, preferSavedAddress = true, resetFailureState = true)
                .onFailure {
                    Log.w(TAG, "Reconnect scan failed to start: ${it.message}")
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
                TAG,
                "GATT 133 on ${device.address}; retrying ${connectRetryCount}/$MAX_CONNECT_RETRIES"
            )
            connectToDevice(device, "gatt-133-retry-$connectRetryCount", delayMs = CONNECT_RETRY_DELAY_MS)
            return true
        }

        if (status == 133 && !didRescanAfterFailure) {
            val bluetoothNum = currentBluetoothNum
            if (!bluetoothNum.isNullOrBlank()) {
                didRescanAfterFailure = true
                connectRetryCount = 0
                Log.w(TAG, "GATT 133 persisted; restarting filtered scan for $bluetoothNum")
                startSensorScan(dataptr, preferSavedAddress = false, resetFailureState = false)
                return true
            }
        }

        emitError("BLE connection failed ($status)")
        return false
    }
}

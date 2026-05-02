package com.berdegeus.glucore

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.PackageManager
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

    private data class DecodedGlucoseReading(
        val mgdl: Double,
        val rate: Double,
        val alarmCode: Int,
        val timestampMs: Long,
        val hasReliableSensorTimestamp: Boolean
    )

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

    fun hasBlePermissions(): Boolean =
        ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
        ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    fun startSensorScan(dataptr: Long): Result<Unit> =
        startSensorScan(dataptr, preferSavedAddress = true, resetFailureState = true)

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
                emitError("No Sibionics device found (timeout)")
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
    }

    // ── GATT callbacks ────────────────────────────────────────────────────────

    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        when (newState) {
            BluetoothProfile.STATE_CONNECTED -> {
                Log.i(TAG, "GATT connected, discovering services")
                cancelDisconnectTimer()
                cancelConnectTimeout()
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

                if (!isStopping && handleConnectionFailure(gatt.device, status)) {
                    return
                }
                emitStatus("disconnected")
            }
        }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
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
        cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        val wrote = if (hasBlePermissions()) gatt.writeDescriptor(cccd) else false
        if (!wrote) {
            emitError("Failed to write CCCD descriptor")
            disconnect()
        }
        Log.i(TAG, "Notifications enabled, waiting for descriptor write confirmation")
    }

    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
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
            if (!writeToSensor(authBytes)) {
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
            if (!writeToSensor(askBytes)) {
                emitError("Failed to write initial sensor request")
                disconnect()
                return
            }
        }
        emitStatus("connected")
    }

    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        if (characteristic.uuid != NOTIFY_UUID) return
        val data = characteristic.value ?: return
        val timestamp = System.currentTimeMillis()

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
                try { Natives.siAuthBytes(dataptr)?.let { writeToSensor(it) } } catch (e: Exception) {
                    Log.e(TAG, "siAuthBytes on re-auth: ${e.message}")
                }
            }
            5L -> {
                Log.i(TAG, "code 5: time sync")
                try { writeToSensor(Natives.getSItimecmd()) } catch (e: Exception) {
                    Log.e(TAG, "getSItimecmd: ${e.message}")
                }
            }
            6L -> {
                Log.i(TAG, "code 6: activation")
                try { writeToSensor(Natives.getSIActivation()) } catch (e: Exception) {
                    Log.e(TAG, "getSIActivation: ${e.message}")
                }
            }
            7L -> {
                Log.i(TAG, "code 7: ask new data")
                try { Natives.siAsknewdata(dataptr)?.let { writeToSensor(it) } } catch (e: Exception) {
                    Log.e(TAG, "siAsknewdata: ${e.message}")
                }
            }
            8L, 9L -> Unit
            10L -> {
                Log.i(TAG, "code 10: reset")
                try { writeToSensor(Natives.getSIResetBytes()) } catch (e: Exception) {
                    Log.e(TAG, "getSIResetBytes: ${e.message}")
                }
            }
            2L -> scheduleDisconnect(30_000L, "code 2: invalid frame")
            3L -> {
                Log.w(TAG, "code 3: retry — reconnecting")
                restartConnection("native-code-3")
            }
            else -> handleDirectGlucoseResult(code, timestamp)
        }
    }

    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            Log.w(TAG, "Characteristic write failed: $status")
        }
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

        val timestampMs = normalizeTimestampMs(
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
        emitHistorySyncProgress()
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
        // Juggluco packs the current reading into one long:
        // low 32 bits = glucose in tenths of mg/dL,
        // next 16 bits = trend * 1000,
        // next 8 bits = alarm code.
        val glucoseTenths = packedReading and 0xFFFFFFFFL
        if (glucoseTenths == 0L) {
            Log.w(TAG, "$source returned glucose=0 for packed value $packedReading")
            return null
        }
        if (glucoseTenths !in 200L..10_000L) {
            Log.w(TAG, "$source returned implausible glucose payload $packedReading (tenths=$glucoseTenths)")
            return null
        }

        val rateRaw = ((packedReading ushr 32) and 0xFFFFL).toShort().toInt()
        val decoded = DecodedGlucoseReading(
            mgdl = glucoseTenths.toDouble() / 10.0,
            rate = rateRaw / 1000.0,
            alarmCode = ((packedReading ushr 48) and 0xFFL).toInt(),
            timestampMs = timestampMs,
            hasReliableSensorTimestamp = hasReliableSensorTimestamp
        )

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
                "timestampMs" to reading.timestampMs
            ),
            "session" to null,
            "warmup" to null,
            "failure" to null
        ))
    }

    private fun emitHistorySyncProgress() {
        onEvent(mapOf(
            "status" to "syncingHistory",
            "connected" to true,
            "sync" to mapOf(
                "receivedCount" to historyReadingsReceived,
                "latestTimestampMs" to lastSyncedTimestampMs
            ),
            "reading" to null,
            "session" to null,
            "warmup" to null,
            "failure" to null
        ))
    }

    private fun normalizeTimestampMs(rawTimestamp: Long?, fallbackTimestampMs: Long): Long {
        val value = rawTimestamp ?: return fallbackTimestampMs
        if (value <= 0L) return fallbackTimestampMs
        return if (value < 10_000_000_000L) value * 1000L else value
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

    private fun writeToSensor(bytes: ByteArray?): Boolean {
        if (bytes == null) { Log.w(TAG, "writeToSensor: null bytes"); return false }
        val gatt = currentGatt ?: return false
        val char = writeChar ?: return false
        if (!hasBlePermissions()) return false
        char.value = bytes
        return gatt.writeCharacteristic(char)
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
                emitError("Connection timeout")
                disconnect()
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
        cancelPendingConnect()
        cancelConnectTimeout()
        connectToDevice(device, reason, delayMs = CONNECT_RETRY_DELAY_MS)
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

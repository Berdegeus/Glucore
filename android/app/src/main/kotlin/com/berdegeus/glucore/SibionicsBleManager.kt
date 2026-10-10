package com.berdegeus.glucore

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.content.Context
import android.os.Build
import android.util.Log
import tk.glucodata.Natives
import java.util.UUID

/**
 * Sibionics EU protocol on top of [BrandBleManager]: GATT service ff30,
 * notify ff31, write ff32, driven by the Natives.SIprocessData state machine.
 */
class SibionicsBleManager(
    context: Context,
    onEvent: (Map<String, Any?>) -> Unit
) : BrandBleManager(context, onEvent) {

    companion object {
        private val SERVICE_UUID = UUID.fromString("0000ff30-0000-1000-8000-00805f9b34fb")
        private val NOTIFY_UUID  = UUID.fromString("0000ff31-0000-1000-8000-00805f9b34fb")
        private val WRITE_UUID   = UUID.fromString("0000ff32-0000-1000-8000-00805f9b34fb")

        private const val REAUTH_DELAY_MS = 1_000L
        private const val NO_VALUE_CODE_2_MS = 30_000L
        private const val NO_VALUE_CODE_8_MS = 5 * 60_000L
        private const val NO_VALUE_CODE_10_MS = 3 * 60_000L
    }

    override val tag = "SibionicsBleManager"
    override val brandName = "Sibionics"
    override val scanServiceUuid: UUID = SERVICE_UUID
    override val reconnectPolicy: ReconnectPolicy = ReconnectPolicy.FAST_FIRST
    // autoConnect is unreliable on older stacks; Juggluco gates it on Android 13 too.
    override val autoConnectAfterTimeout = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU

    private var writeChar: BluetoothGattCharacteristic? = null
    private var currentBluetoothNum: String? = null

    // Set once the sensor has walked this connection through auth, activation
    // and time-sync up to ask-new-data. Past that point the vendor state
    // machine only returns packed readings, so an unrecognised SIprocessData
    // result can be decoded as glucose. Connection-scoped: cleared on
    // disconnect so a half-finished handshake never carries trust over.
    private var handshakeSettled = false

    // Juggluco's `novalue`: codes 2/8/10 mean "no usable data yet". Only if no
    // value follows within the window is the connection restarted.
    private val noValueWatchdog = NoValueWatchdog()
    private var noValueTimer: Runnable? = null
    private var reauthRunnable: Runnable? = null

    override fun prepareScan(): Result<Unit> {
        val bluetoothNum = try { Natives.getSiBluetoothNum(dataptr) } catch (e: Exception) {
            Log.e(tag, "getSiBluetoothNum failed: ${e.message}")
            return Result.failure(Exception("Failed to get BLE device identifier: ${e.message}"))
        }
        currentBluetoothNum = bluetoothNum
        Log.i(tag, "Scanning for device with suffix: $bluetoothNum")
        return Result.success(Unit)
    }

    override fun matchDevice(deviceName: String): Boolean {
        val bluetoothNum = currentBluetoothNum ?: return false
        val savedName = try { Natives.siGetDeviceName(dataptr) } catch (e: Exception) {
            Log.w(tag, "siGetDeviceName failed: ${e.message}")
            null
        }
        if (!savedName.isNullOrBlank() && deviceName == savedName) {
            return true
        }
        if (deviceName.length < 4 || bluetoothNum.length < 4) return false
        return bluetoothNum.regionMatches(0, deviceName, deviceName.length - 4, 4)
    }

    override fun persistMatchedDevice(device: BluetoothDevice) {
        try {
            Natives.siSaveDeviceName(dataptr, device.name ?: "")
            Natives.setDeviceAddress(dataptr, device.address)
        } catch (e: Exception) {
            Log.w(tag, "siSaveDeviceName/setDeviceAddress: ${e.message}")
        }
    }

    override fun onBrandConnected(gatt: BluetoothGatt) {
        try { Natives.EverSenseClear(dataptr) } catch (e: Exception) {
            Log.w(tag, "EverSenseClear failed (non-fatal): ${e.message}")
        }
    }

    override fun onBrandDisconnected() {
        writeChar = null
        handshakeSettled = false
        clearNoValueWatchdog()
        reauthRunnable?.let { mainHandler.removeCallbacks(it) }
        reauthRunnable = null
    }

    override fun disconnect() {
        currentBluetoothNum = null
        super.disconnect()
    }

    override fun onBrandServicesDiscovered(gatt: BluetoothGatt) {
        val service = gatt.getService(SERVICE_UUID)
        if (service == null) {
            recoverFromSetupFailure("service ff30 not found", "Sibionics service not found on device")
            return
        }

        val notifyChar = service.getCharacteristic(NOTIFY_UUID)
        val wChar = service.getCharacteristic(WRITE_UUID)
        if (notifyChar == null || wChar == null) {
            recoverFromSetupFailure("characteristics ff31/ff32 not found", "Required BLE characteristics not found")
            return
        }
        writeChar = wChar
        setupComplete = true

        if (!enableCharacteristicNotification(gatt, notifyChar)) {
            recoverFromSetupFailure("could not enable notifications", "Failed to enable notifications")
            return
        }
        Log.i(tag, "Notifications enabled, waiting for descriptor write confirmation")
    }

    override fun onBrandDescriptorWrite(characteristicUuid: UUID, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            recoverFromSetupFailure("descriptor write failed ($status)", "Failed to enable notifications ($status)")
            return
        }

        val notChinese = try { Natives.siNotchinese(dataptr) } catch (e: Exception) {
            Log.e(tag, "siNotchinese failed: ${e.message}")
            false
        }
        Log.i(
            tag,
            "siNotchinese=$notChinese — ${
                if (notChinese) "sending auth bootstrap"
                else "sending ask-new-data bootstrap"
            }"
        )

        if (notChinese) {
            val authBytes = try { Natives.siAuthBytes(dataptr) } catch (e: Exception) {
                Log.e(tag, "siAuthBytes failed: ${e.message}")
                null
            }
            if (authBytes == null) {
                recoverFromSetupFailure(
                    "siAuthBytes returned null",
                    "siAuthBytes returned null — check dataptr and sensor registration"
                )
                return
            }

            Log.i(tag, "Sending auth bytes (${authBytes.size} bytes)")
            if (!enqueueWrite(writeChar, authBytes)) {
                recoverFromSetupFailure("could not write auth bytes", "Failed to write auth bytes")
                return
            }
        } else {
            val askBytes = try { Natives.siAsknewdata(dataptr) } catch (e: Exception) {
                Log.e(tag, "siAsknewdata bootstrap failed: ${e.message}")
                null
            }
            if (askBytes == null) {
                recoverFromSetupFailure(
                    "siAsknewdata returned null",
                    "siAsknewdata returned null during bootstrap"
                )
                return
            }

            Log.i(tag, "Sending ask-new-data bytes (${askBytes.size} bytes)")
            if (!enqueueWrite(writeChar, askBytes)) {
                recoverFromSetupFailure("could not write initial request", "Failed to write initial sensor request")
                return
            }
        }
        emitStatus("connected")
    }

    override fun onBrandCharacteristicChanged(uuid: UUID, data: ByteArray, timestampMs: Long) {
        if (uuid != NOTIFY_UUID) return

        val code = try {
            Natives.SIprocessData(dataptr, data, timestampMs)
        } catch (e: Exception) {
            Log.e(tag, "SIprocessData threw: ${e.message}")
            return
        }

        Log.d(tag, "SIprocessData code=$code")

        when (code) {
            1L -> {
                clearNoValueWatchdog()
                handleGlucoseReady()
            }
            4L -> {
                clearNoValueWatchdog()
                Log.i(tag, "code 4: re-authenticate (in ${REAUTH_DELAY_MS} ms)")
                // Juggluco waits a second before re-sending the auth bytes; an
                // immediate retry gives the sensor no time to settle.
                reauthRunnable?.let { mainHandler.removeCallbacks(it) }
                reauthRunnable = Runnable {
                    reauthRunnable = null
                    if (writeChar == null) return@Runnable
                    try { Natives.siAuthBytes(dataptr)?.let { enqueueWrite(writeChar, it) } } catch (e: Exception) {
                        Log.e(tag, "siAuthBytes on re-auth: ${e.message}")
                    }
                }.also { mainHandler.postDelayed(it, REAUTH_DELAY_MS) }
            }
            5L -> {
                clearNoValueWatchdog()
                Log.i(tag, "code 5: time sync")
                try { enqueueWrite(writeChar, Natives.getSItimecmd()) } catch (e: Exception) {
                    Log.e(tag, "getSItimecmd: ${e.message}")
                }
            }
            6L -> {
                clearNoValueWatchdog()
                Log.i(tag, "code 6: activation")
                try { enqueueWrite(writeChar, Natives.getSIActivation()) } catch (e: Exception) {
                    Log.e(tag, "getSIActivation: ${e.message}")
                }
            }
            7L -> {
                clearNoValueWatchdog()
                Log.i(tag, "code 7: ask new data")
                handshakeSettled = true
                try { Natives.siAsknewdata(dataptr)?.let { enqueueWrite(writeChar, it) } } catch (e: Exception) {
                    Log.e(tag, "siAsknewdata: ${e.message}")
                }
            }
            9L -> Unit
            8L -> armNoValueWatchdog(NO_VALUE_CODE_8_MS, "code 8")
            10L -> {
                Log.i(tag, "code 10: reset")
                try { enqueueWrite(writeChar, Natives.getSIResetBytes()) } catch (e: Exception) {
                    Log.e(tag, "getSIResetBytes: ${e.message}")
                }
                armNoValueWatchdog(NO_VALUE_CODE_10_MS, "code 10", force = true)
            }
            2L -> armNoValueWatchdog(NO_VALUE_CODE_2_MS, "code 2: invalid frame")
            3L -> {
                clearNoValueWatchdog()
                Log.w(tag, "code 3: retry — reconnecting")
                restartConnection("native-code-3")
            }
            else -> {
                // Only attempt to interpret an unknown code as a packed reading
                // once this connection finished the handshake; otherwise an
                // unexpected vendor return value could masquerade as glucose.
                // decodeUnsolicited is the second gate: it drops anything
                // without rate/alarm bits and re-checks the plausible range,
                // so a stray in-range value still has to survive that.
                if (handshakeSettled) {
                    clearNoValueWatchdog()
                    handleDirectGlucoseResult(code, timestampMs)
                } else {
                    Log.w(tag, "Ignoring unknown SIprocessData code $code (handshake not settled)")
                }
            }
        }
    }

    private fun armNoValueWatchdog(timeoutMs: Long, reason: String, force: Boolean = false) {
        val token = noValueWatchdog.arm(force)
        if (token == null) {
            Log.d(tag, "$reason: no-value watchdog already armed")
            return
        }
        Log.w(tag, "$reason: no value yet; restarting the connection in ${timeoutMs / 1000}s unless data arrives")
        noValueTimer?.let { mainHandler.removeCallbacks(it) }
        noValueTimer = Runnable {
            noValueTimer = null
            if (noValueWatchdog.fire(token)) {
                Log.w(tag, "No value for ${timeoutMs / 1000}s after $reason; restarting the connection")
                restartConnection("no-value-watchdog")
            }
        }.also { mainHandler.postDelayed(it, timeoutMs) }
    }

    private fun clearNoValueWatchdog() {
        if (noValueWatchdog.isArmed) Log.d(tag, "Value arrived; no-value watchdog cleared")
        noValueWatchdog.clear()
        noValueTimer?.let { mainHandler.removeCallbacks(it) }
        noValueTimer = null
    }

    private fun handleGlucoseReady() {
        val readings = try { Natives.getlastGlucose() } catch (e: Exception) {
            Log.e(tag, "getlastGlucose: ${e.message}")
            null
        }

        if (readings == null || readings.isEmpty()) {
            Log.w(tag, "getlastGlucose returned null/empty")
            return
        }

        Log.d(tag, "getlastGlucose raw: ${readings.toList()}")

        val normalized = SibionicsGlucoseDecoder.normalizeTimestamp(
            rawTimestamp = readings.firstOrNull(),
            fallbackTimestampMs = System.currentTimeMillis()
        )
        if (normalized.usedFallback) {
            Log.w(
                tag,
                "getlastGlucose timestamp unusable (raw=${readings.firstOrNull()}); " +
                    "falling back to device clock ${normalized.valueMs}"
            )
        }
        val timestampMs = normalized.valueMs
        val packedReading = if (readings.size >= 2) readings[1] else readings[0]
        val decoded = decodePackedGlucose(
            packedReading = packedReading,
            timestampMs = timestampMs,
            source = "getlastGlucose",
            hasReliableSensorTimestamp = true
        ) ?: return

        deliverReading(decoded)
    }

    private fun handleDirectGlucoseResult(result: Long, timestampMs: Long) {
        var decoded = SibionicsGlucoseDecoder.decodeUnsolicited(
            packedReading = result,
            timestampMs = timestampMs
        )
        if (decoded == null) {
            Log.w(tag, "Discarded unsolicited SIprocessData result: $result")
            return
        }
        Log.i(
            tag,
            "Decoded glucose from SIprocessData: ${decoded.mgdl} mg/dL " +
                "rate=${decoded.rate} alarm=${decoded.alarmCode}"
        )

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
}

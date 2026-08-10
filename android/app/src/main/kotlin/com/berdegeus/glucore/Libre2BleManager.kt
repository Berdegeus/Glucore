package com.berdegeus.glucore

import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.content.Context
import android.util.Log
import tk.glucodata.Natives
import java.util.UUID

/**
 * FreeStyle Libre 2 streaming protocol on top of [BrandBleManager] (ported
 * from Juggluco's Libre2GattCallback). Custom Abbott service 0xfde3 with a
 * login characteristic (f001) and a raw-data characteristic (f002).
 *
 * Two security generations, reported by `Natives.getsensorgen`:
 * - gen 1: write `Natives.sensorUnlockKey` to f001, then listen on f002;
 * - gen 2: challenge/response on f001 (V1/V2 into the Abbott library),
 *   session key `tovalue` decrypts each 46-byte packet via `V2(773, ...)`.
 *
 * Glucose packets arrive as 20+18+8-byte fragments, reassembled and parsed
 * by `Natives.processTooth`. Readings come ~1/min with no back-fill.
 */
class Libre2BleManager(
    context: Context,
    onEvent: (Map<String, Any?>) -> Unit
) : BrandBleManager(context, onEvent) {

    companion object {
        private val SERVICE_UUID = UUID.fromString("0000fde3-0000-1000-8000-00805f9b34fb")
        private val LOGIN_UUID = UUID.fromString("0000f001-0000-1000-8000-00805f9b34fb")
        private val RAW_DATA_UUID = UUID.fromString("0000f002-0000-1000-8000-00805f9b34fb")

        private const val DEVICE_NAME_PREFIX = "ABBOTT"

        // Abbott library opcodes (Juggluco Libre2GattCallback/Gen2).
        private const val V1_AUTH = 28960
        private const val V2_AUTH_PAYLOAD = 6505
        private const val V1_CHECK = 29465
        private const val V1_RELEASE = 37400
        private const val V2_DECRYPT_PACKET = 773
    }

    override val tag = "Libre2BleManager"
    override val brandName = "FreeStyle Libre 2"
    override val scanServiceUuid: UUID = SERVICE_UUID

    private var serial: String = ""
    private var loginChar: BluetoothGattCharacteristic? = null
    private var rawDataChar: BluetoothGattCharacteristic? = null

    private var sensorGen = 0
    private var conphase = 0
    private var contactint = 0
    private var sessionKey = 0
    private val challengeBuffer = ByteArray(25)
    private val assembler = Libre2PacketAssembler()
    private var justEnabledNotification = false
    private var gen1KeyWritten = false

    override fun prepareScan(): Result<Unit> {
        serial = try { Natives.getSensorName(dataptr).orEmpty() } catch (e: Exception) {
            Log.e(tag, "getSensorName failed: ${e.message}")
            ""
        }
        if (serial.isBlank()) {
            return Result.failure(Exception("Libre serial unavailable for device matching"))
        }
        Log.i(tag, "Scanning for ABBOTT$serial")
        return Result.success(Unit)
    }

    override fun matchDevice(deviceName: String): Boolean {
        if (!deviceName.startsWith(DEVICE_NAME_PREFIX)) return false
        return serial.isNotBlank() && deviceName.substring(DEVICE_NAME_PREFIX.length) == serial
    }

    override fun onBrandDisconnected() {
        loginChar = null
        rawDataChar = null
        conphase = 0
        assembler.reset()
        gen1KeyWritten = false
        releaseAuthContext()
    }

    override fun onBrandConnectionLost(status: Int) {
        // Status 19 right after enabling notifications means the sensor
        // rejected the session; reset libg's BLE state so the next connect
        // re-authenticates from scratch (Juggluco Libre2GattCallback).
        if (status == 19 && justEnabledNotification) {
            justEnabledNotification = false
            try { Natives.resetbluetooth(dataptr) } catch (e: Exception) {
                Log.w(tag, "resetbluetooth: ${e.message}")
            }
        }
    }

    override fun disconnect() {
        serial = ""
        super.disconnect()
    }

    override fun onBrandServicesDiscovered(gatt: BluetoothGatt) {
        val service = gatt.getService(SERVICE_UUID)
        if (service == null) {
            emitError("Libre service fde3 not found on device")
            disconnect()
            return
        }
        val login = service.getCharacteristic(LOGIN_UUID)
        val rawData = service.getCharacteristic(RAW_DATA_UUID)
        if (login == null || rawData == null) {
            emitError("Libre characteristics f001/f002 not found")
            disconnect()
            return
        }
        loginChar = login
        rawDataChar = rawData
        setupComplete = true

        sensorGen = try { Natives.getsensorgen(dataptr) } catch (e: Exception) {
            Log.e(tag, "getsensorgen failed: ${e.message}")
            0
        }
        Log.i(tag, "Using security generation $sensorGen")

        if (sensorGen == 2) {
            conphase = 1
            if (!enableCharacteristicNotification(gatt, login)) {
                emitError("Failed to enable Libre login notifications")
                disconnect()
            }
        } else {
            val key = try { Natives.sensorUnlockKey(dataptr) } catch (e: Exception) {
                Log.e(tag, "sensorUnlockKey threw: ${e.message}")
                null
            }
            if (key == null) {
                emitError("Libre unlock key unavailable — rescan the sensor with NFC")
                disconnect()
                return
            }
            conphase = 5
            gen1KeyWritten = false
            enqueueWrite(login, key)
        }
    }

    override fun onBrandDescriptorWrite(characteristicUuid: UUID, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            emitError("Failed to enable Libre notifications ($status)")
            disconnect()
            return
        }
        when (characteristicUuid) {
            LOGIN_UUID -> {
                if (sensorGen == 2 && conphase == 1) {
                    // Ask for the 14-byte security challenge.
                    conphase = 2
                    enqueueWrite(loginChar, byteArrayOf(32))
                }
            }
            RAW_DATA_UUID -> {
                conphase = 4
                justEnabledNotification = true
                assembler.reset()
                emitStatus("connected")
            }
        }
    }

    override fun onBrandCharacteristicWrite(uuid: UUID, status: Int) {
        // Gen 1 only: once the unlock key is written, subscribe to raw data.
        if (sensorGen != 2 && uuid == LOGIN_UUID && conphase == 5 && !gen1KeyWritten) {
            gen1KeyWritten = true
            val gatt = currentGatt ?: return
            val rawData = rawDataChar ?: return
            if (!enableCharacteristicNotification(gatt, rawData)) {
                emitError("Failed to enable Libre data notifications")
                disconnect()
            }
        }
    }

    override fun onBrandCharacteristicChanged(uuid: UUID, data: ByteArray, timestampMs: Long) {
        when (uuid) {
            RAW_DATA_UUID -> {
                if (sensorGen != 2 || conphase == 4) {
                    handleRawFragment(data, timestampMs)
                }
            }
            LOGIN_UUID -> when (conphase) {
                2 -> handleChallenge(data)
                3 -> handleChallengeResponse(data)
            }
        }
    }

    // ── Gen 2 challenge/response (Libre2GattCallback phase2/phase3) ──────────

    private fun handleChallenge(value: ByteArray) {
        if (value.size != 14) {
            emitError("Libre auth challenge has unexpected length ${value.size}")
            disconnect()
            return
        }
        val response = authenticateStream(value)
        if (response == null) {
            disconnect()
            return
        }
        conphase = 3
        justEnabledNotification = true
        enqueueWrite(loginChar, response)
    }

    private fun authenticateStream(challenge: ByteArray): ByteArray? {
        releaseAuthContext()

        val ident = try { Natives.getsensorident(dataptr) } catch (e: Exception) { null }
        if (ident == null) {
            emitError("Libre sensor identity unavailable")
            return null
        }
        val auth = try { Natives.getstreamingAuthenticationData(dataptr) } catch (e: Exception) { null }
        if (auth == null) {
            emitError("Libre streaming authentication data unavailable")
            return null
        }

        val numb = when {
            auth.size == 12 -> ((auth[11].toInt() shl 8) or auth[10].toInt()) and 0xFFFF
            auth.size >= 10 -> -1
            else -> {
                emitError("Libre authentication data too short (${auth.size})")
                return null
            }
        }

        val combined = ByteArray(challenge.size + 10)
        System.arraycopy(auth, 0, combined, 0, 10)
        System.arraycopy(challenge, 0, combined, 10, challenge.size)

        val output = ByteArray(19)
        val p1 = try { Natives.V1(V1_AUTH, numb, ident, null) } catch (e: Throwable) {
            emitError("Abbott library auth call failed: ${e.message}")
            return null
        }
        if (p1 < 0) {
            emitError("Libre stream authentication failed ($p1)")
            return null
        }
        val p2 = try { Natives.V2(V2_AUTH_PAYLOAD, p1, byteArrayOf(1, 31), combined) } catch (e: Throwable) {
            null
        }
        if (p2 == null) {
            releaseContext(p1)
            emitError("Libre stream authentication payload failed")
            return null
        }
        System.arraycopy(p2, 0, output, 0, p2.size)
        contactint = p1
        return output
    }

    private fun handleChallengeResponse(value: ByteArray) {
        when (value.size) {
            7 -> System.arraycopy(value, 0, challengeBuffer, 0, 7)
            18 -> {
                System.arraycopy(value, 0, challengeBuffer, 7, 18)
                val check = try {
                    Natives.V1(V1_CHECK, contactint, byteArrayOf(1), challengeBuffer)
                } catch (e: Throwable) {
                    emitError("Abbott library check call failed: ${e.message}")
                    disconnect()
                    return
                }
                val session = if (check != 0) {
                    releaseAuthContext()
                    0
                } else {
                    contactint
                }
                sessionKey = session
                if (session <= 0) {
                    emitError("Libre session context could not be created")
                    disconnect()
                    return
                }
                Log.i(tag, "Gen2 session established")
                val gatt = currentGatt ?: return
                val rawData = rawDataChar ?: return
                if (!enableCharacteristicNotification(gatt, rawData)) {
                    emitError("Failed to enable Libre data notifications")
                    disconnect()
                }
            }
            else -> {
                emitError("Libre auth response has unexpected length ${value.size}")
                disconnect()
            }
        }
    }

    private fun releaseAuthContext() {
        if (contactint > 0) {
            releaseContext(contactint)
            contactint = 0
        }
    }

    private fun releaseContext(handle: Int) {
        try { Natives.V1(V1_RELEASE, handle, null, null) } catch (e: Throwable) {
            Log.w(tag, "V1 release failed: ${e.message}")
        }
    }

    // ── Glucose stream ────────────────────────────────────────────────────────

    private fun handleRawFragment(value: ByteArray, timestampMs: Long) {
        justEnabledNotification = false
        val packet = assembler.offer(value) ?: return

        val plainPacket = if (sensorGen == 2) {
            try { Natives.V2(V2_DECRYPT_PACKET, sessionKey, packet, null) } catch (e: Throwable) {
                Log.e(tag, "V2 packet decrypt threw: ${e.message}")
                null
            }
        } else {
            packet
        }
        if (plainPacket == null) {
            Log.w(tag, "Could not decrypt Libre packet")
            return
        }

        val result = try { Natives.processTooth(dataptr, plainPacket) } catch (e: Exception) {
            Log.e(tag, "processTooth threw: ${e.message}")
            return
        }
        if (result == 1L) return

        val decoded = decodePackedGlucose(
            packedReading = result,
            timestampMs = timestampMs,
            source = "processTooth",
            hasReliableSensorTimestamp = false
        ) ?: return
        // Libre streams one reading per minute with no back-fill: publish
        // directly instead of going through the history-sync settle flow.
        completeHistorySyncAndEmit(decoded)
    }
}

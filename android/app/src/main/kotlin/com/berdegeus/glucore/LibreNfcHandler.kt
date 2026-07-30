package com.berdegeus.glucore

import android.nfc.Tag
import android.nfc.tech.NfcV
import android.util.Log
import tk.glucodata.Natives
import java.util.Arrays

/**
 * Libre 2 NFC flow (ported from Juggluco's ScanNfcV/AlgNfcV, EU path only):
 * reads the patch info + 344-byte memory, feeds them to `Natives.nfcdata`
 * (which persists the sensor in libg's store) and acts on the status code —
 * activation, streaming enable, warm-up, ready or ended.
 *
 * Runs on the NFC reader-mode callback thread; transceive is blocking.
 * Results are reported through [onEvent] (same map shape as the BLE
 * managers, plus an `nfc` payload) and [onSensorRegistered].
 */
class LibreNfcHandler(
    private val onEvent: (Map<String, Any?>) -> Unit,
    private val onSensorRegistered: (serial: String) -> Unit
) {

    companion object {
        private const val TAG = "LibreNfcHandler"
        private const val NFC_READ_TIMEOUT_MS = 5_000L
        private const val PATCH_MEMORY_LENGTH = 344
    }

    fun handleTag(tag: Tag) {
        try {
            handleTagInternal(tag)
        } catch (t: Throwable) {
            Log.e(TAG, "NFC scan failed: ${t.message}", t)
            emitNfc("error", failureMessage = t.message ?: "NFC scan failed")
        }
    }

    private fun handleTagInternal(tag: Tag) {
        if (!hasAbbottLibrary()) {
            emitNfc("needsLibrary")
            return
        }

        val uid = tag.id
        val isLibre3 = LibreNfcProtocol.isLibre3Uid(uid)
        val info = readInfo(tag, times = if (isLibre3) 1 else 10)
        if (info == null || info.size != 6) {
            if (isLibre3) {
                emitNfc("unsupportedLibre3")
            } else {
                emitNfc("readError", failureMessage = "Could not read the sensor tag info")
            }
            return
        }

        if (isUsGen2(info)) {
            emitNfc("unsupportedUsGen2")
            return
        }

        val data = readPatchMemory(tag)
        if (data == null) {
            emitNfc("readError", failureMessage = "Could not read the sensor memory")
            return
        }

        val result = Natives.nfcdata(uid, info, data)
        val status = LibreNfcProtocol.statusOf(result)
        val glucose = LibreNfcProtocol.glucoseOf(result)
        val outcome = LibreNfcProtocol.outcomeOf(status, glucose)
        Log.i(TAG, "nfcdata status=$status glucose=$glucose outcome=$outcome")

        when (outcome) {
            LibreNfcProtocol.Outcome.NEEDS_ACTIVATION -> {
                if (activate(tag, info, uid)) {
                    registerSensor(uid, info)
                    emitNfc("activated", uid, info, statusName = "warmingUp")
                } else {
                    emitNfc("error", failureMessage = "Sensor activation failed — try again")
                }
            }
            LibreNfcProtocol.Outcome.ENABLE_STREAMING -> {
                enableStreamingIfAllowed(tag, uid, info)
                registerSensor(uid, info)
                emitNfc("streaming", uid, info)
            }
            LibreNfcProtocol.Outcome.ALREADY_STREAMING -> {
                registerSensor(uid, info)
                emitNfc("streaming", uid, info)
            }
            LibreNfcProtocol.Outcome.ENABLE_STREAMING_WARMUP -> {
                enableStreamingIfAllowed(tag, uid, info)
                registerSensor(uid, info)
                emitNfc("warmup", uid, info, statusName = "warmingUp")
            }
            LibreNfcProtocol.Outcome.ENABLE_STREAMING_READY -> {
                enableStreamingIfAllowed(tag, uid, info)
                registerSensor(uid, info)
                emitNfc("ready", uid, info)
            }
            LibreNfcProtocol.Outcome.WARMUP -> {
                registerSensor(uid, info)
                emitNfc("warmup", uid, info, statusName = "warmingUp")
            }
            LibreNfcProtocol.Outcome.READY -> {
                registerSensor(uid, info)
                emitNfc("ready", uid, info)
            }
            LibreNfcProtocol.Outcome.ENDED -> emitNfc("ended", uid, info)
            LibreNfcProtocol.Outcome.UNKNOWN ->
                emitNfc("error", failureMessage = "Unrecognized sensor state (code $status)")
        }
    }

    // ── Native wrappers ───────────────────────────────────────────────────────

    private fun hasAbbottLibrary(): Boolean =
        try { Natives.gethaslibrary() } catch (e: Throwable) {
            Log.e(TAG, "gethaslibrary: ${e.message}")
            false
        }

    private fun isUsGen2(info: ByteArray): Boolean =
        try { Natives.getinfogen(info) == 2 } catch (e: Throwable) {
            Log.w(TAG, "getinfogen: ${e.message}")
            false
        }

    private fun serialOf(uid: ByteArray, info: ByteArray): String? =
        try { Natives.getserial(uid, info) } catch (e: Throwable) {
            Log.e(TAG, "getserial: ${e.message}")
            null
        }

    private fun registerSensor(uid: ByteArray, info: ByteArray) {
        val serial = serialOf(uid, info)
        if (serial.isNullOrBlank()) {
            Log.e(TAG, "Sensor registered natively but serial is unavailable")
            return
        }
        onSensorRegistered(serial)
    }

    /** EU activation: `{2, activationcommand, 7} + activationpayload`. */
    private fun activate(tag: Tag, info: ByteArray, uid: ByteArray): Boolean {
        val command = Natives.activationcommand(info)
        val payload = Natives.activationpayload(uid, info, 0)
        if (payload == null) {
            Log.e(TAG, "activationpayload returned null")
            return false
        }
        if (nfcCommand(tag, LibreNfcProtocol.frameWithPayload(command, payload)) == null) {
            Log.e(TAG, "Activation command failed")
            return false
        }
        return enableStreamingIfAllowed(tag, uid, info)
    }

    /** EU streaming enable over NFC (AlgNfcV.EUenableStreaming). */
    private fun enableStreamingIfAllowed(tag: Tag, uid: ByteArray, info: ByteArray): Boolean {
        val allowed = try { Natives.streamingAllowed() } catch (e: Throwable) {
            Log.w(TAG, "streamingAllowed: ${e.message}")
            true
        }
        if (!allowed) {
            Log.i(TAG, "Streaming not allowed by native settings")
            return false
        }
        val payload = Natives.bluetoothOnKey(uid, info)
        if (payload == null) {
            Log.e(TAG, "bluetoothOnKey returned null; marking as do-not-retry")
            Natives.enabledStreaming(uid, info, 2, null)
            return false
        }
        val address = nfcCommand(tag, LibreNfcProtocol.frameWithPayload(-95, payload))
        return if (address != null) {
            Natives.enabledStreaming(uid, info, 1, address)
            Log.i(TAG, "Streaming enabled over NFC")
            true
        } else {
            Natives.bluetoothback(uid, info)
            Log.e(TAG, "Streaming enable command failed")
            false
        }
    }

    // ── NfcV I/O (AlgNfcV port) ───────────────────────────────────────────────

    private fun readInfo(tag: Tag, times: Int): ByteArray? =
        nfcCommandTimes(tag, LibreNfcProtocol.CMD_READ_INFO, times)

    /** Sends [cmd], strips the status byte from the response. */
    private fun nfcCommand(tag: Tag, cmd: ByteArray, times: Int = 10): ByteArray? =
        nfcCommandTimes(tag, cmd, times)

    private fun nfcCommandTimes(tag: Tag, cmd: ByteArray, times: Int): ByteArray? {
        val whole = wholeNfcCommand(tag, cmd, times) ?: return null
        return Arrays.copyOfRange(whole, 1, whole.size)
    }

    private fun wholeNfcCommand(tag: Tag, cmd: ByteArray, times: Int): ByteArray? {
        repeat(times) {
            val nfcV = NfcV.get(tag)
            if (nfcV == null) {
                Log.e(TAG, "NfcV.get(tag) == null")
                return null
            }
            try {
                nfcV.connect()
                val deadline = System.currentTimeMillis() + NFC_READ_TIMEOUT_MS
                var attempts = times
                do {
                    val response = try { nfcV.transceive(cmd) } catch (t: Throwable) {
                        if (System.currentTimeMillis() > deadline) {
                            Log.w(TAG, "Tag read timeout")
                            return null
                        }
                        null
                    }
                    if (LibreNfcProtocol.goodNfc(response)) {
                        return response
                    }
                } while (--attempts != 0)
            } catch (e: Exception) {
                Log.w(TAG, "NfcV connect failed: ${e.message}")
            } finally {
                try { nfcV.close() } catch (_: Exception) {}
            }
        }
        return null
    }

    /** Reads the 344-byte patch memory in 3-block chunks (readoncedata). */
    private fun readPatchMemory(tag: Tag): ByteArray? {
        val nfcV = NfcV.get(tag) ?: return null
        return try {
            nfcV.connect()
            readBlocks(nfcV, start = 0, len = PATCH_MEMORY_LENGTH)
        } catch (e: Exception) {
            Log.e(TAG, "readPatchMemory: ${e.message}")
            null
        } finally {
            try { nfcV.close() } catch (_: Exception) {}
        }
    }

    private fun readBlocks(nfcV: NfcV, start: Int, len: Int): ByteArray? {
        val startInBlocks = start / 8
        val startOffset = start % 8
        val totalLen = len + startOffset
        val blocks = (totalLen + 7) / 8
        val buffer = ByteArray(blocks * 8)
        var iter = 0
        while (iter < blocks) {
            val currentBlock = startInBlocks + iter
            val count = minOf(3, blocks - iter)
            val received = transceiveWithRetry(
                nfcV,
                byteArrayOf(2, 35, currentBlock.toByte(), (count - 1).toByte())
            )
            if (!LibreNfcProtocol.goodNfc(received) || received!!.size < count * 8 + 1) {
                return null
            }
            val destPos = iter * 8
            val copyLen = minOf(received.size - 1, buffer.size - destPos)
            System.arraycopy(received, 1, buffer, destPos, copyLen)
            iter += count
        }
        return Arrays.copyOfRange(buffer, startOffset, totalLen)
    }

    private fun transceiveWithRetry(nfcV: NfcV, cmd: ByteArray, retries: Int = 5): ByteArray? {
        val deadline = System.currentTimeMillis() + NFC_READ_TIMEOUT_MS
        repeat(retries) {
            try {
                val data = nfcV.transceive(cmd)
                if (LibreNfcProtocol.goodNfc(data)) return data
            } catch (t: Throwable) {
                if (System.currentTimeMillis() > deadline) {
                    Log.w(TAG, "transceive timeout")
                    return null
                }
            }
        }
        return null
    }

    // ── Event emission ────────────────────────────────────────────────────────

    private fun emitNfc(
        result: String,
        uid: ByteArray? = null,
        info: ByteArray? = null,
        statusName: String = statusFor(result),
        failureMessage: String? = null
    ) {
        val serial = if (uid != null && info != null) serialOf(uid, info) else null
        onEvent(mapOf(
            "status" to statusName,
            "connected" to false,
            "session" to null,
            "warmup" to null,
            "reading" to null,
            "failure" to failureMessage?.let { mapOf("message" to it) },
            "nfc" to mapOf(
                "result" to result,
                "sensorId" to serial
            )
        ))
    }

    private fun statusFor(result: String): String = when (result) {
        "error", "readError" -> "error"
        else -> "idle"
    }
}

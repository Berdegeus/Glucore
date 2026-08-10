package com.berdegeus.glucore

/**
 * Pure decision logic for the Libre 2 NFC flow (ported from Juggluco's
 * ScanNfcV/AlgNfcV). Side-effect free for unit testing; the NfcV I/O and
 * native calls live in [LibreNfcHandler].
 */
object LibreNfcProtocol {

    /** ISO 15693 "read patch info" command (`{2, 0xA1, 7}`). */
    val CMD_READ_INFO = byteArrayOf(2, -95, 7)

    /** A response is valid when present and its status byte has bit 0 clear. */
    fun goodNfc(data: ByteArray?): Boolean =
        data != null && data.isNotEmpty() && (data[0].toInt() and 1) == 0

    /** Libre 3 tags have an 8-byte UID whose 7th byte differs from 7. */
    fun isLibre3Uid(uid: ByteArray): Boolean = uid.size == 8 && uid[6].toInt() != 7

    /** `Natives.nfcdata` packs the status in the high 16 bits... */
    fun statusOf(nfcdataResult: Int): Int = (nfcdataResult shr 16) and 0xFF

    /** ...and the current glucose (if any) in the low 16 bits. */
    fun glucoseOf(nfcdataResult: Int): Int = nfcdataResult and 0xFFFF

    enum class Outcome {
        /** Fresh sensor: send the activation command, then enable streaming. */
        NEEDS_ACTIVATION,

        /** Sensor active; BLE streaming must be enabled over NFC now. */
        ENABLE_STREAMING,

        /** Streaming already on; just (re)connect over BLE. */
        ALREADY_STREAMING,

        /** Enable streaming, sensor still warming up. */
        ENABLE_STREAMING_WARMUP,

        /** Enable streaming, sensor ready. */
        ENABLE_STREAMING_READY,

        /** Sensor in its ~60 min warm-up window. */
        WARMUP,

        /** Sensor active and delivering glucose. */
        READY,

        /** Sensor lifetime is over. */
        ENDED,

        UNKNOWN,
    }

    /** Maps the `nfcdata` status byte to an action (ScanNfcV's switch). */
    fun outcomeOf(status: Int, glucose: Int): Outcome = when (status) {
        8 -> Outcome.ENABLE_STREAMING
        9 -> Outcome.ALREADY_STREAMING
        4 -> Outcome.ENDED
        3 -> if (glucose == 0) Outcome.NEEDS_ACTIVATION else Outcome.READY
        5 -> Outcome.WARMUP
        7 -> Outcome.READY
        0x85 -> Outcome.ENABLE_STREAMING_WARMUP
        0x87 -> Outcome.ENABLE_STREAMING_READY
        else -> if (glucose != 0) Outcome.READY else Outcome.UNKNOWN
    }

    /** Builds `{2, cmd, 7} + payload` (activation / streaming-enable frames). */
    fun frameWithPayload(command: Byte, payload: ByteArray): ByteArray {
        val prefix = byteArrayOf(2, command, 7)
        return prefix + payload
    }
}

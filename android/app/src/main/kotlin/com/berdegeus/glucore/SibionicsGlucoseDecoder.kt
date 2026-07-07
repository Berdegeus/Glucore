package com.berdegeus.glucore

data class DecodedGlucoseReading(
    val mgdl: Double,
    val rate: Double,
    val alarmCode: Int,
    val timestampMs: Long,
    val hasReliableSensorTimestamp: Boolean
)

/**
 * Pure decoding logic for the Sibionics/Juggluco packed glucose format.
 * No Android dependencies, so it is directly unit-testable on the JVM.
 */
object SibionicsGlucoseDecoder {

    // Accepted glucose payload range in tenths of mg/dL (40–600 mg/dL).
    private const val MIN_GLUCOSE_TENTHS = 400L
    private const val MAX_GLUCOSE_TENTHS = 6_000L

    /**
     * Decodes a Juggluco packed reading:
     * - bits 0–31:  glucose in tenths of mg/dL
     * - bits 32–47: trend rate * 1000 (signed short)
     * - bits 48–55: alarm code
     *
     * Returns null when the glucose payload is zero or outside the plausible
     * clinical range.
     */
    fun decodePacked(
        packedReading: Long,
        timestampMs: Long,
        hasReliableSensorTimestamp: Boolean
    ): DecodedGlucoseReading? {
        val glucoseTenths = packedReading and 0xFFFFFFFFL
        if (glucoseTenths == 0L) {
            return null
        }
        if (glucoseTenths !in MIN_GLUCOSE_TENTHS..MAX_GLUCOSE_TENTHS) {
            return null
        }

        val rateRaw = ((packedReading ushr 32) and 0xFFFFL).toShort().toInt()
        return DecodedGlucoseReading(
            mgdl = glucoseTenths.toDouble() / 10.0,
            rate = rateRaw / 1000.0,
            alarmCode = ((packedReading ushr 48) and 0xFFL).toInt(),
            timestampMs = timestampMs,
            hasReliableSensorTimestamp = hasReliableSensorTimestamp
        )
    }

    /**
     * Normalizes a sensor timestamp to milliseconds. Values at or below zero
     * fall back to [fallbackTimestampMs]; values that look like seconds
     * (< 10^10) are converted to milliseconds.
     */
    fun normalizeTimestampMs(rawTimestamp: Long?, fallbackTimestampMs: Long): Long {
        val value = rawTimestamp ?: return fallbackTimestampMs
        if (value <= 0L) return fallbackTimestampMs
        return if (value < 10_000_000_000L) value * 1000L else value
    }
}

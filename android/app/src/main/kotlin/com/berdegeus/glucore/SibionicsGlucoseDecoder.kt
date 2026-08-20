package com.berdegeus.glucore

data class DecodedGlucoseReading(
    val mgdl: Double,
    val rate: Double,
    val alarmCode: Int,
    val timestampMs: Long,
    val hasReliableSensorTimestamp: Boolean
)

/**
 * Result of [SibionicsGlucoseDecoder.normalizeTimestamp]: the timestamp in
 * milliseconds plus whether it came from the caller's fallback clock instead
 * of the sensor.
 */
data class NormalizedTimestamp(
    val valueMs: Long,
    val usedFallback: Boolean
)

/**
 * Pure decoding logic for the Sibionics/Juggluco packed glucose format.
 * No Android dependencies, so it is directly unit-testable on the JVM.
 */
object SibionicsGlucoseDecoder {

    // Accepted glucose payload range in tenths of mg/dL (40–600 mg/dL).
    private const val MIN_GLUCOSE_TENTHS = 400L
    private const val MAX_GLUCOSE_TENTHS = 6_000L

    // Smallest packed value that carries rate or alarm bits. Anything below it
    // is bare glucose tenths, indistinguishable from a protocol code.
    private const val MIN_UNSOLICITED_PACKED = 0x10000L

    /**
     * Decodes a Juggluco packed reading:
     * - bits 0–31:  glucose in tenths of mg/dL
     * - bits 32–47: trend rate * 1000 (signed short)
     * - bits 48–55: alarm code
     * - bits 56–63: unused by the format
     *
     * Returns null when the glucose payload is zero, outside the plausible
     * clinical range, or when the unused high bits carry anything — a value
     * with garbage there is not a reading of this protocol.
     */
    fun decodePacked(
        packedReading: Long,
        timestampMs: Long,
        hasReliableSensorTimestamp: Boolean
    ): DecodedGlucoseReading? {
        if ((packedReading ushr 56) != 0L) {
            return null
        }
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
     * Decodes a value the sensor pushed outside the documented `SIprocessData`
     * codes. Only values carrying rate or alarm bits are decoded: a bare
     * glucose payload in this path cannot be told apart from a protocol code,
     * and turning a protocol code into a plausible glucose value is worse than
     * waiting for the reading to arrive through `getlastGlucose`.
     */
    fun decodeUnsolicited(packedReading: Long, timestampMs: Long): DecodedGlucoseReading? {
        if (packedReading < MIN_UNSOLICITED_PACKED) {
            return null
        }
        return decodePacked(
            packedReading = packedReading,
            timestampMs = timestampMs,
            hasReliableSensorTimestamp = false
        )
    }

    /**
     * Normalizes a sensor timestamp to milliseconds. Values at or below zero
     * fall back to [fallbackTimestampMs]; values that look like seconds
     * (< 10^10) are converted to milliseconds. [NormalizedTimestamp.usedFallback]
     * tells the caller the sensor clock was unusable, so it can be logged.
     */
    fun normalizeTimestamp(rawTimestamp: Long?, fallbackTimestampMs: Long): NormalizedTimestamp {
        val value = rawTimestamp ?: return NormalizedTimestamp(fallbackTimestampMs, usedFallback = true)
        if (value <= 0L) return NormalizedTimestamp(fallbackTimestampMs, usedFallback = true)
        val valueMs = if (value < 10_000_000_000L) value * 1000L else value
        return NormalizedTimestamp(valueMs, usedFallback = false)
    }
}

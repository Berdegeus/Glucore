package com.berdegeus.glucore

import java.nio.ByteBuffer
import java.nio.ByteOrder

/** One per-minute record the vendor library keeps for a Sibionics sensor. */
data class StoredReading(val timestampMs: Long, val mgdl: Int, val rate: Double)

/**
 * Parser for the vendor library's own per-sensor store (`polls.dat`).
 *
 * The library records every minute the sensor reports, including the backlog
 * that the BLE layer only surfaces one record per notification. Records are
 * 20 bytes, little-endian: `uint32 time (s), uint32 index, uint32 mg/dL,
 * int32 trend, float change`. The file is pre-allocated, so the unused tail is
 * zeros. Pure on purpose: no Android, unit-testable on the JVM.
 *
 * The file is written by the library while we read it, so every record is
 * validated and anything implausible (zero tail, torn write, garbage) is
 * skipped instead of trusted.
 */
object SibionicsStoreReader {
    const val RECORD_SIZE = 20

    private const val MIN_MGDL = 40L
    private const val MAX_MGDL = 600L

    // Anything before 2014 is not a real reading time; it is a torn or garbage record.
    private const val MIN_TIME_S = 1_400_000_000L

    /**
     * Valid readings with `sinceMs <= time <= untilMs`, ascending by time,
     * one per timestamp (the later record wins).
     */
    fun parse(
        bytes: ByteArray,
        sinceMs: Long = 0L,
        untilMs: Long = Long.MAX_VALUE
    ): List<StoredReading> {
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        val byTime = LinkedHashMap<Long, StoredReading>()
        var offset = 0
        while (offset + RECORD_SIZE <= bytes.size) {
            val timeS = buffer.getInt(offset).toLong() and 0xFFFFFFFFL
            val mgdl = buffer.getInt(offset + 8).toLong() and 0xFFFFFFFFL
            val change = buffer.getFloat(offset + 16)
            offset += RECORD_SIZE

            if (timeS < MIN_TIME_S) continue
            if (mgdl < MIN_MGDL || mgdl > MAX_MGDL) continue
            if (change.isNaN() || change.isInfinite()) continue

            val timestampMs = timeS * 1000L
            if (timestampMs < sinceMs || timestampMs > untilMs) continue
            byTime[timestampMs] = StoredReading(timestampMs, mgdl.toInt(), change.toDouble())
        }
        return byTime.values.sortedBy { it.timestampMs }
    }
}

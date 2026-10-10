package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder

class SibionicsStoreReaderTest {

    private fun record(timeS: Long, index: Int, mgdl: Long, trend: Int = 3, change: Float = 0f): ByteArray =
        ByteBuffer.allocate(SibionicsStoreReader.RECORD_SIZE).order(ByteOrder.LITTLE_ENDIAN).apply {
            putInt(timeS.toInt())
            putInt(index)
            putInt(mgdl.toInt())
            putInt(trend)
            putFloat(change)
        }.array()

    private fun file(vararg records: ByteArray, zeroTail: Int = 0): ByteArray =
        records.fold(ByteArray(0)) { acc, r -> acc + r } + ByteArray(zeroTail)

    private val t0 = 1_790_000_000L

    @Test
    fun `parses time, glucose and change, in milliseconds`() {
        val out = SibionicsStoreReader.parse(file(record(t0, 5, 110, change = 1.3f)))
        assertEquals(1, out.size)
        assertEquals(t0 * 1000L, out[0].timestampMs)
        assertEquals(110, out[0].mgdl)
        assertEquals(1.3, out[0].rate, 0.0001)
    }

    @Test
    fun `preallocated zero tail is ignored`() {
        val out = SibionicsStoreReader.parse(file(record(t0, 5, 110), zeroTail = 400))
        assertEquals(1, out.size)
    }

    @Test
    fun `a partial trailing record is ignored`() {
        val bytes = file(record(t0, 5, 110)) + ByteArray(7) { 1 }
        assertEquals(1, SibionicsStoreReader.parse(bytes).size)
    }

    @Test
    fun `glucose outside 40 to 600 is dropped`() {
        val out = SibionicsStoreReader.parse(
            file(record(t0, 5, 39), record(t0 + 60, 6, 40), record(t0 + 120, 7, 600), record(t0 + 180, 8, 601))
        )
        assertEquals(listOf(40, 600), out.map { it.mgdl })
    }

    @Test
    fun `implausible time and non finite change are dropped`() {
        val out = SibionicsStoreReader.parse(
            file(
                record(12345, 5, 110),
                record(t0, 6, 110, change = Float.NaN),
                record(t0 + 60, 7, 110, change = Float.POSITIVE_INFINITY),
                record(t0 + 120, 8, 111)
            )
        )
        assertEquals(1, out.size)
        assertEquals(111, out[0].mgdl)
    }

    @Test
    fun `result is ascending and one per timestamp, later record wins`() {
        val out = SibionicsStoreReader.parse(
            file(record(t0 + 120, 7, 130), record(t0, 5, 100), record(t0 + 60, 6, 110), record(t0, 9, 105))
        )
        assertEquals(listOf(t0 * 1000, (t0 + 60) * 1000, (t0 + 120) * 1000), out.map { it.timestampMs })
        assertEquals(105, out[0].mgdl)
    }

    @Test
    fun `since and until bound the window inclusively`() {
        val bytes = file(record(t0, 5, 100), record(t0 + 60, 6, 110), record(t0 + 120, 7, 120))
        val out = SibionicsStoreReader.parse(bytes, sinceMs = (t0 + 60) * 1000, untilMs = (t0 + 60) * 1000)
        assertEquals(listOf(110), out.map { it.mgdl })
    }

    @Test
    fun `empty and tiny input yield nothing`() {
        assertTrue(SibionicsStoreReader.parse(ByteArray(0)).isEmpty())
        assertTrue(SibionicsStoreReader.parse(ByteArray(19)).isEmpty())
    }
}

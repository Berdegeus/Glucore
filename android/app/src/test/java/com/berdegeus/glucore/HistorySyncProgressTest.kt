package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HistorySyncProgressTest {
    private val hour = 3_600_000L

    @Test
    fun `halfway between first record and now is 50 percent`() {
        assertEquals(50, HistorySyncProgress.percent(0L, 5 * hour, 10 * hour))
    }

    @Test
    fun `starts at 0 and never passes 100`() {
        assertEquals(0, HistorySyncProgress.percent(0L, 0L, 10 * hour))
        assertEquals(100, HistorySyncProgress.percent(0L, 20 * hour, 10 * hour))
    }

    @Test
    fun `unknown until the first record arrives`() {
        assertNull(HistorySyncProgress.percent(null, null, 10 * hour))
        assertNull(HistorySyncProgress.percent(0L, null, 10 * hour))
    }

    @Test
    fun `no span means no estimate`() {
        assertNull(HistorySyncProgress.percent(10 * hour, 10 * hour, 10 * hour))
        assertNull(HistorySyncProgress.percent(11 * hour, 11 * hour, 10 * hour))
    }

    @Test
    fun `a record older than the first clamps to zero`() {
        assertEquals(0, HistorySyncProgress.percent(5 * hour, 2 * hour, 10 * hour))
    }
}

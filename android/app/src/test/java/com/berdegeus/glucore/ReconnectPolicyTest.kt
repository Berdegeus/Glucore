package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReconnectPolicyTest {

    @Test
    fun `default keeps the original 30s 2min 5min schedule`() {
        val p = ReconnectPolicy.DEFAULT
        assertEquals(30_000L, p.delayMs(0))
        assertEquals(120_000L, p.delayMs(1))
        assertEquals(300_000L, p.delayMs(2))
    }

    @Test
    fun `last step repeats once the schedule is exhausted`() {
        assertEquals(300_000L, ReconnectPolicy.DEFAULT.delayMs(3))
        assertEquals(300_000L, ReconnectPolicy.DEFAULT.delayMs(99))
        assertEquals(300_000L, ReconnectPolicy.FAST_FIRST.delayMs(99))
    }

    @Test
    fun `fast first retries immediately then backs off monotonically`() {
        val p = ReconnectPolicy.FAST_FIRST
        assertEquals(0L, p.delayMs(0))
        val delays = (0..10).map { p.delayMs(it) }
        assertEquals(delays.sorted(), delays)
    }

    @Test
    fun `negative attempt is clamped to the first step`() {
        assertEquals(0L, ReconnectPolicy.FAST_FIRST.delayMs(-3))
    }

    @Test
    fun `short lived connection is not stable for fast first`() {
        val p = ReconnectPolicy.FAST_FIRST
        assertFalse(p.isStable(2_000L))
        assertTrue(p.isStable(30_000L))
    }

    @Test
    fun `default treats every connection as stable`() {
        assertTrue(ReconnectPolicy.DEFAULT.isStable(0L))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `empty schedule is rejected`() {
        ReconnectPolicy(longArrayOf())
    }
}

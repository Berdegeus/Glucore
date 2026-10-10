package com.berdegeus.glucore

import com.berdegeus.glucore.ConnectionWatchdog.Action
import com.berdegeus.glucore.ConnectionWatchdog.Phase
import org.junit.Assert.assertEquals
import org.junit.Test

class ConnectionWatchdogTest {

    private val cfg = ConnectionWatchdog.Config(
        idleGraceMs = 60_000L,
        attemptMaxAgeMs = 360_000L,
        connectedNoValueMs = 300_000L
    )

    private fun eval(
        phase: Phase,
        sinceProgressMs: Long = 0L,
        sinceValueMs: Long = 0L,
        sessionActive: Boolean = true,
        adapterEnabled: Boolean = true
    ) = ConnectionWatchdog.evaluate(
        sessionActive = sessionActive,
        adapterEnabled = adapterEnabled,
        phase = phase,
        sinceProgressMs = sinceProgressMs,
        sinceValueMs = sinceValueMs,
        config = cfg
    )

    // The 10-10 incident: GATT gone, no scan, no timer, nothing scheduled.
    @Test
    fun `idle chain with an active session is kicked once the grace passes`() {
        assertEquals(Action.NONE, eval(Phase.IDLE, sinceProgressMs = 59_000L))
        assertEquals(Action.KICK, eval(Phase.IDLE, sinceProgressMs = 60_000L))
        assertEquals(Action.KICK, eval(Phase.IDLE, sinceProgressMs = 3 * 3_600_000L))
    }

    @Test
    fun `a stopped session is never revived`() {
        assertEquals(Action.NONE, eval(Phase.IDLE, sinceProgressMs = 3_600_000L, sessionActive = false))
        assertEquals(Action.NONE, eval(Phase.ATTEMPTING, sinceProgressMs = 3_600_000L, sessionActive = false))
        assertEquals(Action.NONE, eval(Phase.CONNECTED, sinceValueMs = 3_600_000L, sessionActive = false))
    }

    @Test
    fun `nothing to retry while Bluetooth is off`() {
        assertEquals(Action.NONE, eval(Phase.IDLE, sinceProgressMs = 3_600_000L, adapterEnabled = false))
    }

    // Healthy backoff: the longest step is 5 min, it must not be cut short.
    @Test
    fun `a long backoff is left alone, a frozen one is not`() {
        assertEquals(Action.NONE, eval(Phase.ATTEMPTING, sinceProgressMs = 300_000L))
        assertEquals(Action.NONE, eval(Phase.ATTEMPTING, sinceProgressMs = 359_000L))
        assertEquals(Action.KICK, eval(Phase.ATTEMPTING, sinceProgressMs = 360_000L))
    }

    @Test
    fun `a connected link that keeps delivering is left alone`() {
        assertEquals(Action.NONE, eval(Phase.CONNECTED, sinceProgressMs = 3_600_000L, sinceValueMs = 60_000L))
    }

    @Test
    fun `a connected link gone silent is restarted`() {
        assertEquals(Action.NONE, eval(Phase.CONNECTED, sinceValueMs = 299_000L))
        assertEquals(Action.KICK, eval(Phase.CONNECTED, sinceValueMs = 300_000L))
    }

    @Test
    fun `defaults keep the backoff ceiling below the attempt limit`() {
        // FAST_FIRST's last step is 5 min; the default limit must clear it with room for a scan.
        val defaults = ConnectionWatchdog.Config()
        val longestBackoff = ReconnectPolicy.FAST_FIRST.delayMs(Int.MAX_VALUE)
        assert(defaults.attemptMaxAgeMs > longestBackoff + 30_000L) {
            "attemptMaxAgeMs=${defaults.attemptMaxAgeMs} would cut a ${longestBackoff}ms backoff short"
        }
    }
}

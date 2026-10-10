package com.berdegeus.glucore

/**
 * Delay schedule for automatic reconnection after an unexpected disconnect.
 *
 * Pure on purpose: the BLE stack can't run on the JVM, but the decision of
 * *when* to retry can. The last step repeats once the schedule is exhausted.
 *
 * [stableConnectionMs] guards against a connect→drop loop: a connection that
 * ended before it lived this long does not reset the schedule, so a sensor
 * that accepts the link and immediately drops it keeps backing off instead of
 * being retried at the fast first step forever.
 */
class ReconnectPolicy(
    private val stepsMs: LongArray,
    val stableConnectionMs: Long = 0L
) {
    init {
        require(stepsMs.isNotEmpty()) { "ReconnectPolicy needs at least one step" }
        require(stepsMs.all { it >= 0L }) { "ReconnectPolicy steps must be >= 0" }
    }

    /** Delay before the retry that follows [failedAttempts] earlier retries. */
    fun delayMs(failedAttempts: Int): Long =
        stepsMs[failedAttempts.coerceIn(0, stepsMs.size - 1)]

    /** Whether a connection that lived [connectedForMs] counts as stable. */
    fun isStable(connectedForMs: Long): Boolean = connectedForMs >= stableConnectionMs

    companion object {
        /** Original schedule, kept for the brands that haven't been tuned yet. */
        val DEFAULT = ReconnectPolicy(longArrayOf(30_000L, 120_000L, 300_000L))

        /**
         * Sibionics pushes a reading every minute, so a 30 s first wait loses
         * a whole sample window. Retry at once, then back off.
         */
        val FAST_FIRST = ReconnectPolicy(
            stepsMs = longArrayOf(0L, 5_000L, 15_000L, 30_000L, 120_000L, 300_000L),
            stableConnectionMs = 30_000L
        )
    }
}

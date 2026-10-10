package com.berdegeus.glucore

/**
 * Progress of the history backlog a sensor streams after (re)connecting.
 *
 * The total isn't known up front, but the backlog arrives oldest-first and
 * ends at "now", so how far the latest record has moved between the first
 * record and the present is a good estimate. Pure so it is unit-testable.
 */
object HistorySyncProgress {
    /** Fraction in 0.0..1.0, or null when it can't be estimated yet. */
    fun fraction(firstMs: Long?, latestMs: Long?, nowMs: Long): Double? {
        if (firstMs == null || latestMs == null) return null
        val span = nowMs - firstMs
        if (span <= 0L) return null
        return ((latestMs - firstMs).toDouble() / span).coerceIn(0.0, 1.0)
    }

    fun percent(firstMs: Long?, latestMs: Long?, nowMs: Long): Int? =
        fraction(firstMs, latestMs, nowMs)?.let { (it * 100).toInt() }
}

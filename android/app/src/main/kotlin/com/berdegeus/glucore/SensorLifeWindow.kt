package com.berdegeus.glucore

/** When the active sensor started and when it is expected to end. */
data class SensorLifeWindow(val startMs: Long, val expectedEndMs: Long)

/**
 * Validates what the vendor library reports for the sensor's life.
 *
 * The library computes both ends itself (`getSensorStartmsec` and
 * `sensorends`, i.e. start + expected wear duration, ~22.8 days for Sibionics
 * EU). Until the sensor has delivered its first data the start is not known
 * and the end is meaningless, so anything that does not describe a plausible
 * sensor life is reported as unknown instead of as a wrong number of days.
 * Pure: no Android, unit-testable on the JVM.
 */
object SensorLifeCalculator {
    private const val DAY_MS = 24L * 60 * 60 * 1000

    // Shortest and longest life of any supported sensor, with slack
    // (Libre 2 ~15 d, Sibionics up to ~24 d).
    private const val MIN_LIFE_MS = 7 * DAY_MS
    private const val MAX_LIFE_MS = 40 * DAY_MS

    fun window(startMs: Long, endSeconds: Long): SensorLifeWindow? {
        if (startMs <= 0L || endSeconds <= 0L) return null
        val endMs = endSeconds * 1000L
        val life = endMs - startMs
        if (life < MIN_LIFE_MS || life > MAX_LIFE_MS) return null
        return SensorLifeWindow(startMs, endMs)
    }
}

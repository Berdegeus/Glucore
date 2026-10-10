package com.berdegeus.glucore

/**
 * Picks which directory under `files/sensors/` holds the active sensor's store.
 *
 * The library names the directory with a prefix in front of the id that
 * `Natives.activeSensors()` reports (`51152834U451CCW7` for `834U451CCW7`), so
 * an exact match is only the first try. Pure so the choice is unit-testable.
 */
object SensorStoreLocator {
    /** A directory name and when its store was last written. */
    data class Candidate(val name: String, val lastModifiedMs: Long)

    fun pick(sensorName: String?, candidates: List<Candidate>): String? {
        if (candidates.isEmpty()) return null

        if (!sensorName.isNullOrEmpty()) {
            candidates.firstOrNull { it.name == sensorName }?.let { return it.name }
            // Several directories can share a suffix after re-pairings; the one
            // written most recently belongs to the sensor in use.
            candidates
                .filter { it.name.endsWith(sensorName) }
                .maxByOrNull { it.lastModifiedMs }
                ?.let { return it.name }
        }

        // Unknown sensor name: only safe when there is nothing to confuse it with.
        return candidates.singleOrNull()?.name
    }
}

package com.berdegeus.glucore

import java.io.File

/**
 * What `libg.so` keeps on disk about paired sensors, and how to forget it.
 *
 * The library stores a registry (`sensors/sensors.dat`) plus one directory per
 * sensor (`sensors/<id>/`) holding, among other things, the point up to which
 * the history was already delivered and the saved BLE address. Dropping only
 * the session row leaves that state behind, and a re-pair then gets no
 * backlog (issue #37).
 *
 * Two constraints, both found on the device:
 *
 * - The registry and the per-sensor directories must go together: removing
 *   the directory but keeping `sensors.dat` makes the library dereference a
 *   null pointer in `addSIscangetName` on the next registration.
 * - The files cannot be removed while the library is loaded: it keeps the
 *   state in memory, and re-pairing afterwards crashes inside `SIprocessData`.
 *   So unpairing only leaves a marker, and the wipe runs at the next process
 *   start, before `libg.so` is touched ([applyPendingWipe]).
 */
object NativeSensorState {
    const val SENSORS_DIR = "sensors"
    const val WIPE_PENDING_MARKER = "native_wipe_pending"

    /** Everything to remove so the next pairing starts from a clean store. */
    fun pathsToWipe(filesDir: File): List<File> = listOf(File(filesDir, SENSORS_DIR))

    /** True when nothing is left behind afterwards. */
    fun wipe(filesDir: File): Boolean =
        pathsToWipe(filesDir).all { !it.exists() || it.deleteRecursively() }

    /** Asks the next process start to forget the paired sensors. */
    fun markWipePending(filesDir: File): Boolean =
        runCatching {
            filesDir.mkdirs()
            File(filesDir, WIPE_PENDING_MARKER).writeText("1")
        }.isSuccess

    /**
     * Runs the wipe requested by [markWipePending]. The marker is dropped only
     * once the wipe fully succeeded, so a failure is retried on the next start.
     * Returns true when a wipe was pending and completed.
     */
    fun applyPendingWipe(filesDir: File): Boolean {
        val marker = File(filesDir, WIPE_PENDING_MARKER)
        if (!marker.exists()) return false
        if (!wipe(filesDir)) return false
        marker.delete()
        return true
    }
}

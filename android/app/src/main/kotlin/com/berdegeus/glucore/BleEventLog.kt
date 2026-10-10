package com.berdegeus.glucore

import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Persistent, size-bounded log of BLE lifecycle transitions.
 *
 * Logcat is a ring buffer that rolls in minutes on a busy phone, so by the
 * time a dropped connection is noticed the evidence is gone. This keeps the
 * state changes (connect, disconnect and why, reconnect scheduled, watchdog
 * kicks) in the app's own files, readable afterwards with
 * `adb shell run-as com.berdegeus.glucore cat files/ble_events.log`.
 *
 * Two files, [maxBytes] each: when the current one fills up it becomes the
 * `.1` file and a fresh one starts, so the footprint stays under 2 × [maxBytes].
 * Writes go through a single background thread and never block the caller.
 * Never log readings, barcodes or anything else that identifies the person.
 */
class BleEventLog(
    private val file: File,
    private val maxBytes: Long = DEFAULT_MAX_BYTES,
    private val clock: () -> Long = System::currentTimeMillis,
    private val executor: java.util.concurrent.Executor = SHARED_EXECUTOR
) {
    private val older: File get() = File(file.parentFile, file.name + ".1")

    fun log(tag: String, message: String) {
        val line = "${format(clock())} $tag $message\n"
        executor.execute { append(line) }
    }

    /** Both files, oldest first. Test and diagnostics helper. */
    fun readAll(): String = buildString {
        if (older.exists()) append(older.readText())
        if (file.exists()) append(file.readText())
    }

    private fun append(line: String) {
        try {
            file.parentFile?.mkdirs()
            if (file.exists() && file.length() + line.length > maxBytes) {
                older.delete()
                file.renameTo(older)
            }
            file.appendText(line)
        } catch (_: Exception) {
            // Diagnostics must never take the BLE stack down with them.
        }
    }

    private fun format(timeMs: Long): String =
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(Date(timeMs))

    companion object {
        const val DEFAULT_MAX_BYTES = 256L * 1024L
        const val FILE_NAME = "ble_events.log"

        private val SHARED_EXECUTOR = Executors.newSingleThreadExecutor { r ->
            Thread(r, "ble-event-log").apply { isDaemon = true }
        }

        @Volatile
        private var instance: BleEventLog? = null

        /** One log per process, in the app's files directory. */
        fun get(filesDir: File): BleEventLog =
            instance ?: synchronized(this) {
                instance ?: BleEventLog(File(filesDir, FILE_NAME)).also { instance = it }
            }
    }
}

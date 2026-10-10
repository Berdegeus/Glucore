package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class BleEventLogTest {

    @get:Rule
    val tmp = TemporaryFolder()

    // Runs the write inline so the test needs no sleeping.
    private val inline = java.util.concurrent.Executor { it.run() }

    private fun logIn(dir: File, maxBytes: Long = 1_000L) =
        BleEventLog(File(dir, "ble_events.log"), maxBytes, clock = { 0L }, executor = inline)

    @Test
    fun `lines are written in order with tag and message`() {
        val log = logIn(tmp.root)
        log.log("Sibionics", "GATT connected")
        log.log("Sibionics", "GATT disconnected (status=8)")
        val lines = log.readAll().lines().filter { it.isNotEmpty() }
        assertEquals(2, lines.size)
        assertTrue(lines[0].endsWith("Sibionics GATT connected"))
        assertTrue(lines[1].endsWith("Sibionics GATT disconnected (status=8)"))
    }

    @Test
    fun `size stays bounded and the newest lines survive`() {
        val log = logIn(tmp.root, maxBytes = 300L)
        repeat(200) { log.log("T", "event number $it") }
        val current = File(tmp.root, "ble_events.log")
        val older = File(tmp.root, "ble_events.log.1")
        assertTrue(current.length() <= 300L)
        assertTrue(older.length() <= 300L)
        assertTrue(log.readAll().contains("event number 199"))
        assertFalse("oldest lines must have been dropped", log.readAll().contains("event number 0\n"))
    }

    @Test
    fun `a missing directory is created and write errors never throw`() {
        val nested = File(tmp.root, "a/b")
        logIn(nested).log("T", "ok")
        assertTrue(File(nested, "ble_events.log").exists())

        // A path that cannot be written (a file where the directory should be).
        val blocker = tmp.newFile("blocker")
        BleEventLog(File(blocker, "x.log"), clock = { 0L }, executor = inline).log("T", "dropped")
    }
}

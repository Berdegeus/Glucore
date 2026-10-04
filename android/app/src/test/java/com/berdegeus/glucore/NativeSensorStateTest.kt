package com.berdegeus.glucore

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class NativeSensorStateTest {

    private lateinit var filesDir: File

    @Before
    fun setUp() {
        filesDir = Files.createTempDirectory("glucore-files").toFile()
    }

    @After
    fun tearDown() {
        filesDir.deleteRecursively()
    }

    private fun seedNativeStore() {
        val sensor = File(filesDir, "sensors/51152834U451CCW7").apply { mkdirs() }
        File(filesDir, "sensors/sensors.dat").writeText("registry")
        File(sensor, "data.dat").writeText("history cursor")
        File(sensor, "info.dat").writeText("ble address")
    }

    @Test
    fun `pathsToWipe covers the registry and the per-sensor directories together`() {
        assertEquals(listOf(File(filesDir, "sensors")), NativeSensorState.pathsToWipe(filesDir))
    }

    @Test
    fun `wipe removes the registry and every sensor directory`() {
        seedNativeStore()

        assertTrue(NativeSensorState.wipe(filesDir))

        assertFalse(File(filesDir, "sensors/sensors.dat").exists())
        assertFalse(File(filesDir, "sensors/51152834U451CCW7").exists())
    }

    @Test
    fun `wipe leaves unrelated files alone`() {
        seedNativeStore()
        val settings = File(filesDir, "settings.dat").apply { writeText("keep") }

        NativeSensorState.wipe(filesDir)

        assertTrue(settings.exists())
    }

    @Test
    fun `wipe on an empty store succeeds`() {
        assertTrue(NativeSensorState.wipe(filesDir))
    }

    @Test
    fun `applyPendingWipe does nothing without a marker`() {
        seedNativeStore()

        assertFalse(NativeSensorState.applyPendingWipe(filesDir))

        assertTrue(File(filesDir, "sensors/sensors.dat").exists())
    }

    @Test
    fun `applyPendingWipe wipes the store and drops the marker`() {
        seedNativeStore()
        assertTrue(NativeSensorState.markWipePending(filesDir))

        assertTrue(NativeSensorState.applyPendingWipe(filesDir))

        assertFalse(File(filesDir, "sensors").exists())
        assertFalse(File(filesDir, NativeSensorState.WIPE_PENDING_MARKER).exists())
        // Second start: nothing left to do.
        assertFalse(NativeSensorState.applyPendingWipe(filesDir))
    }

    @Test
    fun `markWipePending leaves the store untouched until the next start`() {
        seedNativeStore()

        NativeSensorState.markWipePending(filesDir)

        assertTrue(File(filesDir, "sensors/sensors.dat").exists())
        assertTrue(File(filesDir, NativeSensorState.WIPE_PENDING_MARKER).exists())
    }
}

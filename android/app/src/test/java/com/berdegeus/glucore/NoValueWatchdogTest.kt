package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NoValueWatchdogTest {

    @Test
    fun `fires when nothing clears it`() {
        val w = NoValueWatchdog()
        val token = w.arm()!!
        assertTrue(w.isArmed)
        assertTrue(w.fire(token))
        assertFalse(w.isArmed)
    }

    @Test
    fun `a value in between cancels the pending deadline`() {
        val w = NoValueWatchdog()
        val token = w.arm()!!
        w.clear()
        assertFalse(w.fire(token))
    }

    @Test
    fun `second arm keeps the first deadline`() {
        val w = NoValueWatchdog()
        val first = w.arm()!!
        assertNull(w.arm())
        assertTrue(w.fire(first))
    }

    @Test
    fun `forced arm replaces the earlier deadline`() {
        val w = NoValueWatchdog()
        val first = w.arm()!!
        val second = w.arm(force = true)!!
        assertFalse(w.fire(first))
        assertTrue(w.fire(second))
    }

    @Test
    fun `a stale timer cannot fire after clear and re-arm`() {
        val w = NoValueWatchdog()
        val old = w.arm()!!
        w.clear()
        val fresh = w.arm()!!
        assertFalse(w.fire(old))
        assertTrue(w.fire(fresh))
    }

    @Test
    fun `fires only once per arming`() {
        val w = NoValueWatchdog()
        val token = w.arm()!!
        assertTrue(w.fire(token))
        assertFalse(w.fire(token))
    }

    @Test
    fun `can be armed again after firing`() {
        val w = NoValueWatchdog()
        w.fire(w.arm()!!)
        assertNotNull(w.arm())
        assertEquals(true, w.isArmed)
    }
}

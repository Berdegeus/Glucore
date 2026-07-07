package com.berdegeus.glucore

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccuChekProtocolTest {

    @Test
    fun `control commands match Juggluco byte sequences`() {
        assertArrayEquals(
            byteArrayOf(0x02, 0x95.toByte(), 0x2C),
            AccuChekProtocol.CMD_UNBONDED_BOOTSTRAP
        )
        assertArrayEquals(
            byteArrayOf(0x05, 0x00, 0x00, 0x8E.toByte(), 0x00),
            AccuChekProtocol.CMD_SESSION_INFO
        )
        assertArrayEquals(
            byteArrayOf(0x05, 0xFF.toByte(), 0xFF.toByte(), 0x36, 0xF0.toByte()),
            AccuChekProtocol.CMD_START_STREAM
        )
    }

    @Test
    fun `control ack is recognized by length and matched by content`() {
        val ack = byteArrayOf(0x03, 0x05, 0x7D, 0x8D.toByte())
        assertTrue(AccuChekProtocol.isControlAck(ack))
        assertTrue(AccuChekProtocol.isExpectedControlAck(ack))

        val unexpectedButAck = byteArrayOf(0x03, 0x05, 0x00, 0x00)
        assertTrue(AccuChekProtocol.isControlAck(unexpectedButAck))
        assertFalse(AccuChekProtocol.isExpectedControlAck(unexpectedButAck))

        assertFalse(AccuChekProtocol.isControlAck(byteArrayOf(0x01, 0x03, 0x01)))
    }

    @Test
    fun `device name matching requires AC- prefix and serial suffix`() {
        assertTrue(AccuChekProtocol.matchesDeviceName("AC-XY123456", "123456"))
        assertFalse(AccuChekProtocol.matchesDeviceName("XY-123456", "123456"))
        assertFalse(AccuChekProtocol.matchesDeviceName("AC-XY123457", "123456"))
        assertFalse(AccuChekProtocol.matchesDeviceName("AC-anything", ""))
    }

    @Test
    fun `uuids follow the SIG CGM profile`() {
        assertEquals("0000181f-0000-1000-8000-00805f9b34fb", AccuChekProtocol.CGM_SERVICE.toString())
        assertEquals("00002aa7-0000-1000-8000-00805f9b34fb", AccuChekProtocol.CGM_MEASUREMENT.toString())
        assertEquals("00002aac-0000-1000-8000-00805f9b34fb", AccuChekProtocol.CGM_CONTROL.toString())
        assertEquals("00002a52-0000-1000-8000-00805f9b34fb", AccuChekProtocol.RACP.toString())
    }
}

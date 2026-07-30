package com.berdegeus.glucore

import com.berdegeus.glucore.LibreNfcProtocol.Outcome
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LibreNfcProtocolTest {

    @Test
    fun `nfcdata result unpacks status high 16 bits and glucose low 16 bits`() {
        val result = (9 shl 16) or 123
        assertEquals(9, LibreNfcProtocol.statusOf(result))
        assertEquals(123, LibreNfcProtocol.glucoseOf(result))
        // Status byte is masked to 8 bits like Juggluco's `ret & 0xFF`.
        assertEquals(0x85, LibreNfcProtocol.statusOf(0x185 shl 16))
    }

    @Test
    fun `status codes map to ScanNfcV actions`() {
        assertEquals(Outcome.ENABLE_STREAMING, LibreNfcProtocol.outcomeOf(8, 0))
        assertEquals(Outcome.ALREADY_STREAMING, LibreNfcProtocol.outcomeOf(9, 0))
        assertEquals(Outcome.ENDED, LibreNfcProtocol.outcomeOf(4, 0))
        assertEquals(Outcome.NEEDS_ACTIVATION, LibreNfcProtocol.outcomeOf(3, 0))
        assertEquals(Outcome.READY, LibreNfcProtocol.outcomeOf(3, 105))
        assertEquals(Outcome.WARMUP, LibreNfcProtocol.outcomeOf(5, 0))
        assertEquals(Outcome.READY, LibreNfcProtocol.outcomeOf(7, 0))
        assertEquals(Outcome.ENABLE_STREAMING_WARMUP, LibreNfcProtocol.outcomeOf(0x85, 0))
        assertEquals(Outcome.ENABLE_STREAMING_READY, LibreNfcProtocol.outcomeOf(0x87, 0))
        assertEquals(Outcome.UNKNOWN, LibreNfcProtocol.outcomeOf(17, 0))
        assertEquals(Outcome.READY, LibreNfcProtocol.outcomeOf(17, 98))
    }

    @Test
    fun `goodNfc requires data with even status byte`() {
        assertTrue(LibreNfcProtocol.goodNfc(byteArrayOf(0, 1, 2)))
        assertFalse(LibreNfcProtocol.goodNfc(byteArrayOf(1, 1, 2)))
        assertFalse(LibreNfcProtocol.goodNfc(ByteArray(0)))
        assertFalse(LibreNfcProtocol.goodNfc(null))
    }

    @Test
    fun `libre3 uid heuristic`() {
        assertTrue(LibreNfcProtocol.isLibre3Uid(byteArrayOf(1, 2, 3, 4, 5, 6, 8, 8)))
        assertFalse(LibreNfcProtocol.isLibre3Uid(byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8)))
        assertFalse(LibreNfcProtocol.isLibre3Uid(byteArrayOf(1, 2, 3, 4)))
    }

    @Test
    fun `frames carry the 2-cmd-7 prefix and the payload`() {
        val frame = LibreNfcProtocol.frameWithPayload(-95, byteArrayOf(9, 8, 7))
        assertArrayEquals(byteArrayOf(2, -95, 7, 9, 8, 7), frame)
        assertArrayEquals(byteArrayOf(2, -95, 7), LibreNfcProtocol.CMD_READ_INFO)
    }
}

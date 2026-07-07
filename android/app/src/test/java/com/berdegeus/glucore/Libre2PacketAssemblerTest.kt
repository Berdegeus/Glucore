package com.berdegeus.glucore

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class Libre2PacketAssemblerTest {

    private fun fragment(size: Int, fill: Byte) = ByteArray(size) { fill }

    @Test
    fun `three in-order fragments produce a 46-byte packet`() {
        val assembler = Libre2PacketAssembler()
        assertNull(assembler.offer(fragment(20, 1)))
        assertNull(assembler.offer(fragment(18, 2)))
        val packet = assembler.offer(fragment(8, 3))
        assertNotNull(packet)
        val expected = fragment(20, 1) + fragment(18, 2) + fragment(8, 3)
        assertArrayEquals(expected, packet)
    }

    @Test
    fun `fragments out of order are dropped until a new sequence starts`() {
        val assembler = Libre2PacketAssembler()
        assertNull(assembler.offer(fragment(18, 2))) // no first fragment yet
        assertNull(assembler.offer(fragment(8, 3)))
        assertNull(assembler.offer(fragment(20, 1)))
        assertNull(assembler.offer(fragment(8, 3))) // second fragment missing
        assertNull(assembler.offer(fragment(18, 2)))
        assertNotNull(assembler.offer(fragment(8, 3)))
    }

    @Test
    fun `a new 20-byte fragment restarts the sequence`() {
        val assembler = Libre2PacketAssembler()
        assembler.offer(fragment(20, 1))
        assembler.offer(fragment(18, 2))
        // Restart before the third fragment arrives.
        assembler.offer(fragment(20, 9))
        assertNull(assembler.offer(fragment(8, 3)))
        assembler.offer(fragment(18, 8))
        val packet = assembler.offer(fragment(8, 7))
        assertNotNull(packet)
        assertArrayEquals(fragment(20, 9) + fragment(18, 8) + fragment(8, 7), packet)
    }

    @Test
    fun `unexpected sizes are ignored`() {
        val assembler = Libre2PacketAssembler()
        assertNull(assembler.offer(fragment(21, 1)))
        assertNull(assembler.offer(ByteArray(0)))
        assembler.offer(fragment(20, 1))
        assembler.offer(fragment(18, 2))
        assertNull(assembler.offer(fragment(7, 3)))
        assertNotNull(assembler.offer(fragment(8, 3)))
    }

    @Test
    fun `reset drops a partial sequence`() {
        val assembler = Libre2PacketAssembler()
        assembler.offer(fragment(20, 1))
        assembler.offer(fragment(18, 2))
        assembler.reset()
        assertNull(assembler.offer(fragment(8, 3)))
    }
}

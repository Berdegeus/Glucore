package com.berdegeus.glucore

import com.berdegeus.glucore.SensorStoreLocator.Candidate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SensorStoreLocatorTest {
    @Test
    fun `an exact name wins`() {
        val dirs = listOf(Candidate("ABC", 1), Candidate("XABC", 9))
        assertEquals("ABC", SensorStoreLocator.pick("ABC", dirs))
    }

    @Test
    fun `a prefixed directory matches the id it ends with`() {
        val dirs = listOf(Candidate("51152834U451CCW7", 5))
        assertEquals("51152834U451CCW7", SensorStoreLocator.pick("834U451CCW7", dirs))
    }

    @Test
    fun `among several suffix matches the most recently written wins`() {
        val dirs = listOf(Candidate("1AAA", 10), Candidate("2AAA", 30), Candidate("3AAA", 20))
        assertEquals("2AAA", SensorStoreLocator.pick("AAA", dirs))
    }

    @Test
    fun `no match and several directories picks nothing`() {
        val dirs = listOf(Candidate("OLD1", 1), Candidate("OLD2", 2))
        assertNull(SensorStoreLocator.pick("NEW", dirs))
    }

    @Test
    fun `unknown name with a single directory uses it`() {
        assertEquals("ONLY", SensorStoreLocator.pick(null, listOf(Candidate("ONLY", 1))))
        assertEquals("ONLY", SensorStoreLocator.pick("OTHER", listOf(Candidate("ONLY", 1))))
    }

    @Test
    fun `unknown name with several directories picks nothing`() {
        assertNull(SensorStoreLocator.pick(null, listOf(Candidate("A", 1), Candidate("B", 2))))
    }

    @Test
    fun `no directories picks nothing`() {
        assertNull(SensorStoreLocator.pick("X", emptyList()))
    }
}

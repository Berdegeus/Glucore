package com.berdegeus.glucore

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GattStatusTest {
    @Test
    fun `out of range and peer-terminated links count as link loss`() {
        for (status in listOf(8, 19, 22, 34)) {
            assertTrue("status $status", GattStatus.isLinkLoss(status))
        }
    }

    @Test
    fun `success, 133 and unknown codes are not link loss`() {
        for (status in listOf(0, 133, 257, 62)) {
            assertFalse("status $status", GattStatus.isLinkLoss(status))
        }
    }
}

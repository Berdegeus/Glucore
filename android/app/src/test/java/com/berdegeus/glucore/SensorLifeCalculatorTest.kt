package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SensorLifeCalculatorTest {
    private val day = 24L * 60 * 60 * 1000
    private val start = 1_790_000_000_000L

    @Test
    fun `a Sibionics EU life of about 22 days is accepted as reported`() {
        // 1_972_800 s is the library's default Sibionics EU wear duration.
        val window = SensorLifeCalculator.window(start, start / 1000 + 1_972_800)!!
        assertEquals(start, window.startMs)
        assertEquals(start + 1_972_800_000L, window.expectedEndMs)
    }

    @Test
    fun `a Libre 2 life of about 15 days is accepted`() {
        assertEquals(
            start + 15 * day,
            SensorLifeCalculator.window(start, (start + 15 * day) / 1000)!!.expectedEndMs
        )
    }

    @Test
    fun `an unknown start means an unknown life`() {
        assertNull(SensorLifeCalculator.window(0L, 1_792_000_000L))
        assertNull(SensorLifeCalculator.window(-1L, 1_792_000_000L))
    }

    @Test
    fun `an unset end means an unknown life`() {
        assertNull(SensorLifeCalculator.window(start, 0L))
    }

    @Test
    fun `an end before the start is rejected`() {
        assertNull(SensorLifeCalculator.window(start, start / 1000 - 3600))
    }

    @Test
    fun `an implausibly short or long life is rejected, not shown as a wrong day count`() {
        assertNull(SensorLifeCalculator.window(start, (start + 2 * day) / 1000))
        assertNull(SensorLifeCalculator.window(start, (start + 200 * day) / 1000))
    }
}

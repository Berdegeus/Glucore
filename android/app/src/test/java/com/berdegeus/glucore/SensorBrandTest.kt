package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Test

class SensorBrandTest {

    @Test
    fun `fromLibreVersion maps Juggluco type codes`() {
        assertEquals(SensorBrand.SIBIONICS, SensorBrand.fromLibreVersion(0x10))
        assertEquals(SensorBrand.ACCUCHEK, SensorBrand.fromLibreVersion(0x20))
        // Libre 1/2 is the fallback for every other code, matching the
        // default branch of Juggluco's callback factory.
        assertEquals(SensorBrand.LIBRE2, SensorBrand.fromLibreVersion(0))
        assertEquals(SensorBrand.LIBRE2, SensorBrand.fromLibreVersion(2))
        assertEquals(SensorBrand.LIBRE2, SensorBrand.fromLibreVersion(0x40))
    }

    @Test
    fun `fromWireName round-trips every brand`() {
        for (brand in SensorBrand.entries) {
            assertEquals(brand, SensorBrand.fromWireName(brand.wireName))
        }
    }

    @Test
    fun `fromWireName defaults to sibionics for unknown or null`() {
        assertEquals(SensorBrand.SIBIONICS, SensorBrand.fromWireName(null))
        assertEquals(SensorBrand.SIBIONICS, SensorBrand.fromWireName("dexcom"))
        assertEquals(SensorBrand.SIBIONICS, SensorBrand.fromWireName(""))
    }
}

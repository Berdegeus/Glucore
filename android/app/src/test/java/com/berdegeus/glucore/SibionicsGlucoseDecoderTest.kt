package com.berdegeus.glucore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class SibionicsGlucoseDecoderTest {

    private fun pack(glucoseTenths: Long, rateThousandths: Int, alarmCode: Int): Long {
        val rateBits = rateThousandths.toShort().toLong() and 0xFFFFL
        return (glucoseTenths and 0xFFFFFFFFL) or
            (rateBits shl 32) or
            ((alarmCode.toLong() and 0xFFL) shl 48)
    }

    @Test
    fun decodePacked_roundTripsTypicalReading() {
        val packed = pack(glucoseTenths = 1043L, rateThousandths = 21, alarmCode = 2)

        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = packed,
            timestampMs = 1_720_000_000_000L,
            hasReliableSensorTimestamp = true
        )

        assertNotNull(decoded)
        assertEquals(104.3, decoded!!.mgdl, 1e-9)
        assertEquals(0.021, decoded.rate, 1e-9)
        assertEquals(2, decoded.alarmCode)
        assertEquals(1_720_000_000_000L, decoded.timestampMs)
        assertEquals(true, decoded.hasReliableSensorTimestamp)
    }

    @Test
    fun decodePacked_acceptsLowerBoundOf40Mgdl() {
        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = pack(400L, 0, 0),
            timestampMs = 0L,
            hasReliableSensorTimestamp = false
        )

        assertNotNull(decoded)
        assertEquals(40.0, decoded!!.mgdl, 1e-9)
    }

    @Test
    fun decodePacked_acceptsUpperBoundOf600Mgdl() {
        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = pack(6_000L, 0, 0),
            timestampMs = 0L,
            hasReliableSensorTimestamp = false
        )

        assertNotNull(decoded)
        assertEquals(600.0, decoded!!.mgdl, 1e-9)
    }

    @Test
    fun decodePacked_rejectsJustBelowLowerBound() {
        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = pack(399L, 0, 0),
            timestampMs = 0L,
            hasReliableSensorTimestamp = false
        )

        assertNull(decoded)
    }

    @Test
    fun decodePacked_rejectsJustAboveUpperBound() {
        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = pack(6_001L, 0, 0),
            timestampMs = 0L,
            hasReliableSensorTimestamp = false
        )

        assertNull(decoded)
    }

    @Test
    fun decodePacked_rejectsZeroGlucose() {
        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = pack(0L, 21, 2),
            timestampMs = 0L,
            hasReliableSensorTimestamp = false
        )

        assertNull(decoded)
    }

    @Test
    fun decodePacked_decodesNegativeRateAsSignedShort() {
        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = pack(1043L, -1500, 0),
            timestampMs = 0L,
            hasReliableSensorTimestamp = false
        )

        assertNotNull(decoded)
        assertEquals(-1.5, decoded!!.rate, 1e-9)
    }

    @Test
    fun normalizeTimestampMs_convertsSecondsToMilliseconds() {
        val result = SibionicsGlucoseDecoder.normalizeTimestampMs(
            rawTimestamp = 1_720_000_000L,
            fallbackTimestampMs = 42L
        )

        assertEquals(1_720_000_000_000L, result)
    }

    @Test
    fun normalizeTimestampMs_passesMillisecondsThrough() {
        val result = SibionicsGlucoseDecoder.normalizeTimestampMs(
            rawTimestamp = 1_720_000_000_000L,
            fallbackTimestampMs = 42L
        )

        assertEquals(1_720_000_000_000L, result)
    }

    @Test
    fun normalizeTimestampMs_fallsBackForNonPositiveValues() {
        assertEquals(
            42L,
            SibionicsGlucoseDecoder.normalizeTimestampMs(rawTimestamp = 0L, fallbackTimestampMs = 42L)
        )
        assertEquals(
            42L,
            SibionicsGlucoseDecoder.normalizeTimestampMs(rawTimestamp = -5L, fallbackTimestampMs = 42L)
        )
        assertEquals(
            42L,
            SibionicsGlucoseDecoder.normalizeTimestampMs(rawTimestamp = null, fallbackTimestampMs = 42L)
        )
    }
}

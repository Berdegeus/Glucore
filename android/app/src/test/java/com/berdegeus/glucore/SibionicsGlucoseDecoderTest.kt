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
    fun normalizeTimestamp_convertsSecondsToMilliseconds() {
        val result = SibionicsGlucoseDecoder.normalizeTimestamp(
            rawTimestamp = 1_720_000_000L,
            fallbackTimestampMs = 42L
        )

        assertEquals(1_720_000_000_000L, result.valueMs)
        assertEquals(false, result.usedFallback)
    }

    @Test
    fun normalizeTimestamp_passesMillisecondsThrough() {
        val result = SibionicsGlucoseDecoder.normalizeTimestamp(
            rawTimestamp = 1_720_000_000_000L,
            fallbackTimestampMs = 42L
        )

        assertEquals(1_720_000_000_000L, result.valueMs)
        assertEquals(false, result.usedFallback)
    }

    @Test
    fun normalizeTimestamp_fallsBackForNonPositiveValues() {
        assertEquals(
            42L,
            SibionicsGlucoseDecoder.normalizeTimestamp(rawTimestamp = 0L, fallbackTimestampMs = 42L).valueMs
        )
        assertEquals(
            42L,
            SibionicsGlucoseDecoder.normalizeTimestamp(rawTimestamp = -5L, fallbackTimestampMs = 42L).valueMs
        )
        assertEquals(
            42L,
            SibionicsGlucoseDecoder.normalizeTimestamp(rawTimestamp = null, fallbackTimestampMs = 42L).valueMs
        )
    }

    @Test
    fun normalizeTimestamp_flagsFallbackForNullZeroAndNegative() {
        assertEquals(
            true,
            SibionicsGlucoseDecoder.normalizeTimestamp(rawTimestamp = null, fallbackTimestampMs = 42L).usedFallback
        )
        assertEquals(
            true,
            SibionicsGlucoseDecoder.normalizeTimestamp(rawTimestamp = 0L, fallbackTimestampMs = 42L).usedFallback
        )
        assertEquals(
            true,
            SibionicsGlucoseDecoder.normalizeTimestamp(rawTimestamp = -5L, fallbackTimestampMs = 42L).usedFallback
        )
    }

    // ── Unused high bits (spec ARCH-05) ─────────────────────────────────────

    @Test
    fun decodePacked_rejectsPayloadWithNonZeroHighBits() {
        val packed = pack(glucoseTenths = 1043L, rateThousandths = 21, alarmCode = 2) or
            (1L shl 56)

        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = packed,
            timestampMs = 1_720_000_000_000L,
            hasReliableSensorTimestamp = true
        )

        assertNull(decoded)
    }

    @Test
    fun decodePacked_acceptsPayloadWithHighBitsClear() {
        val packed = pack(glucoseTenths = 1043L, rateThousandths = 21, alarmCode = 2)

        val decoded = SibionicsGlucoseDecoder.decodePacked(
            packedReading = packed,
            timestampMs = 1_720_000_000_000L,
            hasReliableSensorTimestamp = true
        )

        assertNotNull(decoded)
        assertEquals(104.3, decoded!!.mgdl, 1e-9)
    }

    // ── Unsolicited path (spec ARCH-04) ─────────────────────────────────────

    @Test
    fun decodeUnsolicited_discardsProtocolCode() {
        val decoded = SibionicsGlucoseDecoder.decodeUnsolicited(
            packedReading = 4L,
            timestampMs = 1_720_000_000_000L
        )

        assertNull(decoded)
    }

    @Test
    fun decodeUnsolicited_discardsBareGlucosePayloadWithoutRateOrAlarmBits() {
        val decoded = SibionicsGlucoseDecoder.decodeUnsolicited(
            packedReading = 1043L,
            timestampMs = 1_720_000_000_000L
        )

        assertNull(decoded)
    }

    @Test
    fun decodeUnsolicited_decodesPayloadCarryingRateBits() {
        val packed = pack(glucoseTenths = 1043L, rateThousandths = 21, alarmCode = 0)

        val decoded = SibionicsGlucoseDecoder.decodeUnsolicited(
            packedReading = packed,
            timestampMs = 1_720_000_000_000L
        )

        assertNotNull(decoded)
        assertEquals(104.3, decoded!!.mgdl, 1e-9)
        assertEquals(0.021, decoded.rate, 1e-9)
        assertEquals(1_720_000_000_000L, decoded.timestampMs)
        assertEquals(false, decoded.hasReliableSensorTimestamp)
    }

    @Test
    fun decodeUnsolicited_stillRejectsImplausibleGlucoseAboveTheBitThreshold() {
        val packed = pack(glucoseTenths = 6_001L, rateThousandths = 21, alarmCode = 0)

        val decoded = SibionicsGlucoseDecoder.decodeUnsolicited(
            packedReading = packed,
            timestampMs = 1_720_000_000_000L
        )

        assertNull(decoded)
    }

    // ── isBareGlucoseResult: the per-minute push observed on a live sensor ───────

    @Test
    fun isBareGlucoseResult_trueForTheValuesAliveSensorPushed() {
        // Returned by SIprocessData between 17:36 and 17:46 on 2026-10-12; each one
        // matched the glucose stored for that minute (86 to 122 mg/dL).
        val observed = listOf(860L, 880L, 900L, 940L, 1040L, 1170L, 1210L, 1220L)

        observed.forEach { assertEquals("code $it", true, SibionicsGlucoseDecoder.isBareGlucoseResult(it)) }
    }

    @Test
    fun isBareGlucoseResult_isTrueExactlyOnTheAcceptedRange() {
        assertEquals(false, SibionicsGlucoseDecoder.isBareGlucoseResult(399L))
        assertEquals(true, SibionicsGlucoseDecoder.isBareGlucoseResult(400L))
        assertEquals(true, SibionicsGlucoseDecoder.isBareGlucoseResult(6_000L))
        assertEquals(false, SibionicsGlucoseDecoder.isBareGlucoseResult(6_001L))
    }

    @Test
    fun isBareGlucoseResult_falseForTheProtocolCodesTheStateMachineHandlesByName() {
        // 1..10 are handled explicitly before this is ever asked; they sit far below 40 mg/dL anyway.
        (0L..10L).forEach { assertEquals("code $it", false, SibionicsGlucoseDecoder.isBareGlucoseResult(it)) }
    }

    @Test
    fun isBareGlucoseResult_falseForAPackedReading() {
        // Rate/alarm bits set: that is a packed reading, decoded by decodeUnsolicited, not a bare number.
        assertEquals(false, SibionicsGlucoseDecoder.isBareGlucoseResult(pack(860L, 12, 3)))
        assertEquals(true, SibionicsGlucoseDecoder.decodeUnsolicited(pack(860L, 12, 3), 0L) != null)
    }

    @Test
    fun isBareGlucoseResult_andDecodeUnsolicitedNeverBothAcceptTheSameValue() {
        // The two paths are disjoint: a value is decoded as a packed reading, or it
        // is a bare number to be fetched through getlastGlucose, never both.
        listOf(0L, 7L, 860L, 1_210L, 6_000L, 0x10000L, pack(860L, 1, 0), pack(1_043L, -5, 3)).forEach { value ->
            val bare = SibionicsGlucoseDecoder.isBareGlucoseResult(value)
            val packed = SibionicsGlucoseDecoder.decodeUnsolicited(value, 0L) != null
            assertEquals("value $value", false, bare && packed)
        }
    }
}

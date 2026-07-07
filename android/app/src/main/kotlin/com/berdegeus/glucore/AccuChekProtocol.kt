package com.berdegeus.glucore

import java.util.UUID

/**
 * Pure constants and helpers for the Accu-Chek SmartGuide BLE protocol
 * (standard SIG CGM profile, ported from Juggluco's AccuGattCallback).
 * Kept side-effect free so the handshake pieces are unit-testable.
 */
object AccuChekProtocol {

    val CGM_SERVICE: UUID = UUID.fromString("0000181f-0000-1000-8000-00805f9b34fb")

    val CGM_MEASUREMENT: UUID = UUID.fromString("00002aa7-0000-1000-8000-00805f9b34fb")
    val CGM_FEATURE: UUID = UUID.fromString("00002aa8-0000-1000-8000-00805f9b34fb")
    val CGM_STATUS: UUID = UUID.fromString("00002aa9-0000-1000-8000-00805f9b34fb")
    val CGM_SESSION_START_TIME: UUID = UUID.fromString("00002aaa-0000-1000-8000-00805f9b34fb")
    val CGM_SESSION_RUN_TIME: UUID = UUID.fromString("00002aab-0000-1000-8000-00805f9b34fb")
    val CGM_CONTROL: UUID = UUID.fromString("00002aac-0000-1000-8000-00805f9b34fb")
    val RACP: UUID = UUID.fromString("00002a52-0000-1000-8000-00805f9b34fb")

    val DEVICE_NAME: UUID = UUID.fromString("00002a00-0000-1000-8000-00805f9b34fb")
    val APPEARANCE: UUID = UUID.fromString("00002a01-0000-1000-8000-00805f9b34fb")
    val MANUFACTURER_NAME: UUID = UUID.fromString("00002a29-0000-1000-8000-00805f9b34fb")
    val MODEL_NUMBER: UUID = UUID.fromString("00002a24-0000-1000-8000-00805f9b34fb")
    val SERIAL_NUMBER: UUID = UUID.fromString("00002a25-0000-1000-8000-00805f9b34fb")
    val HARDWARE_REVISION: UUID = UUID.fromString("00002a27-0000-1000-8000-00805f9b34fb")
    val FIRMWARE_REVISION: UUID = UUID.fromString("00002a26-0000-1000-8000-00805f9b34fb")
    val SYSTEM_ID: UUID = UUID.fromString("00002a23-0000-1000-8000-00805f9b34fb")

    /** Written to CGM control while unbonded to bootstrap the session. */
    val CMD_UNBONDED_BOOTSTRAP = byteArrayOf(0x02, 0x95.toByte(), 0x2C)

    /** Written to CGM control after the run-time read (phase 1). */
    val CMD_SESSION_INFO = byteArrayOf(0x05, 0x00, 0x00, 0x8E.toByte(), 0x00)

    /** Written to CGM control at phase 2 to start streaming. */
    val CMD_START_STREAM = byteArrayOf(0x05, 0xFF.toByte(), 0xFF.toByte(), 0x36, 0xF0.toByte())

    /** Expected 4-byte acknowledgement indicated on CGM control. */
    val CONTROL_ACK = byteArrayOf(0x03, 0x05, 0x7D, 0x8D.toByte())

    fun isControlAck(value: ByteArray): Boolean = value.size == CONTROL_ACK.size

    fun isExpectedControlAck(value: ByteArray): Boolean = value.contentEquals(CONTROL_ACK)

    /** SmartGuide advertises as `AC-<...serial>`. */
    fun matchesDeviceName(deviceName: String, serial: String): Boolean =
        serial.isNotBlank() && deviceName.startsWith("AC-") && deviceName.endsWith(serial)
}

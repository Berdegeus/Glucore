package com.berdegeus.glucore

import java.io.Serializable

/**
 * Represents Glucore's locally cached view of a Sibionics glucose sensor session.
 * 
 * The authoritative native registration/restore path now lives behind the JNI
 * bridge adapter. This record mirrors the latest native-backed session for the
 * active Android implementation and monitoring simulation. It includes:
 * - Sensor registration metadata (barcode, UUID)
 * - Transmitter assignment (optional until submitted)
 * - Session lifecycle state
 * - Registration timestamp
 */
data class SibionicsSessionRecord(
    val sensorId: String,  // Native-backed sensor identifier / barcode
    val transmitterId: String? = null,  // Transmitter barcode (optional until submitted)
    val status: SessionStatus = SessionStatus.REGISTERED,  // Current status
    val registeredAtMs: Long = System.currentTimeMillis(),
    val connectedAtMs: Long? = null,
    val brand: SensorBrand = SensorBrand.SIBIONICS
) : Serializable {

    /**
     * Returns a snapshot suitable for Flutter layer.
     */
    fun toSnapshot(): SensorSessionSnapshot {
        return SensorSessionSnapshot(
            sensorId = sensorId,
            transmitterId = transmitterId,
            connected = status == SessionStatus.CONNECTED || status == SessionStatus.MONITORING,
            brand = brand
        )
    }

    fun copyWithTransmitter(transmitterId: String): SibionicsSessionRecord {
        return copy(transmitterId = transmitterId)
    }

    fun copyWithStatus(status: SessionStatus): SibionicsSessionRecord {
        return copy(
            status = status,
            connectedAtMs = if (status == SessionStatus.CONNECTED) System.currentTimeMillis() else connectedAtMs
        )
    }

    enum class SessionStatus {
        REGISTERED,      // Sensor barcode scanned and validated
        AWAITING_TRANSMITTER,  // Sensor registered, waiting for transmitter
        TRANSMITTER_ASSIGNED,  // Transmitter barcode submitted
        CONNECTED,       // BLE connection established (or monitoring started with timer)
        MONITORING,      // Actively monitoring with protocol events
        DISCONNECTED,    // Cleanly disconnected
        ERROR
    }
}

/**
 * Snapshot for Flutter layer - maps domain session to native representation.
 */
data class SensorSessionSnapshot(
    val sensorId: String,
    val transmitterId: String? = null,
    val connected: Boolean = false,
    val brand: SensorBrand = SensorBrand.SIBIONICS
)

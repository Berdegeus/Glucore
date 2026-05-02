package com.berdegeus.glucore

/**
 * Validates and parses Sibionics sensor/transmitter barcodes.
 * 
 * Sensor barcodes are intentionally passed through with minimal validation so
 * the native bridge remains the source of truth for real-world formats.
 * Transmitter barcodes: separate format (typically alphanumeric, also 16+ characters)
 */
object SibionicsBarcode {
    const val TRANSMITTER_BARCODE_MIN_LENGTH = 6

    fun validateSensorBarcode(barcode: String): Result {
        val trimmed = barcode.trim()
        
        return when {
            trimmed.isEmpty() -> Result.Error("Sensor barcode cannot be empty")
            else -> Result.Valid(trimmed)
        }
    }

    fun validateTransmitterBarcode(barcode: String): Result {
        val trimmed = barcode.trim()
        
        return when {
            trimmed.isEmpty() -> Result.Error("Transmitter barcode cannot be empty")
            trimmed.length < TRANSMITTER_BARCODE_MIN_LENGTH -> Result.Error("Transmitter barcode too short")
            !trimmed.all { it.isLetterOrDigit() } -> Result.Error("Transmitter barcode must be alphanumeric")
            else -> Result.Valid(trimmed)
        }
    }

    sealed class Result {
        data class Valid(val barcode: String) : Result()
        data class Error(val message: String) : Result()
    }
}

package com.berdegeus.glucore

/**
 * Validates and parses Sibionics sensor barcodes.
 *
 * Sensor barcodes are intentionally passed through with minimal validation so
 * the native bridge remains the source of truth for real-world formats.
 */
object SibionicsBarcode {

    fun validateSensorBarcode(barcode: String): Result {
        val trimmed = barcode.trim()

        return when {
            trimmed.isEmpty() -> Result.Error("Sensor barcode cannot be empty")
            else -> Result.Valid(trimmed)
        }
    }

    sealed class Result {
        data class Valid(val barcode: String) : Result()
        data class Error(val message: String) : Result()
    }
}

package com.berdegeus.glucore

/**
 * Glucore Sibionics Native Bridge Interface
 *
 * This is Glucore-owned Android integration code around a minimal JNI bridge.
 * It delegates into proprietary Sibionics native libraries packaged inside the
 * Android app and isolates that dependency from the Flutter layers.
 *
 * PROPRIETARY DEPENDENCY NOTICE:
 * This interface depends on native libraries extracted from the Juggluco Android application.
 * The integration approach is derived from the Juggluco Sibionics implementation path.
 * See NOTICE_JUGGLUCO_NATIVE.md for detailed provenance information.
 */
object GlucoreSibionicsBridge {

    init {
        // Load the native bridge library
        System.loadLibrary("glucore-sibionics-bridge")
    }

    /**
     * Initialize the Sibionics native bridge.
     *
     * @param filesDir Application files directory for native storage
     * @param nativeLibraryDir Native library directory for loading dependencies
     * @param countryCode Country code for regional configuration
     * @return 0 on success, negative value on failure
     */
    external fun init(filesDir: String, nativeLibraryDir: String, countryCode: String): Int

    /**
     * Return the most recent native bridge loader/error detail.
     */
    external fun getLastError(): String

    /**
     * Register a sensor with the provided barcode.
     *
     * @param barcode Raw sensor barcode string from the app/UI
     * @param subtype Sensor subtype (0 = standard, 3 = transmitter required)
     * @return JSON string with registration result or error
     */
    external fun registerSensor(barcode: String, subtype: Int): String

    /**
     * Restore the currently active sensor session.
     *
     * @return JSON string with active sensor data or error
     */
    external fun restoreActiveSensor(): String

    /**
     * Save a matched Bluetooth device for the sensor.
     *
     * @param sensorId Sensor identifier
     * @param deviceName Bluetooth device name
     * @param macAddress Bluetooth MAC address
     * @return true if saved successfully
     */
    external fun saveMatchedDevice(sensorId: String, deviceName: String, macAddress: String): Boolean

    /**
     * Get the initial write command for connecting to a sensor.
     *
     * @param sensorId Sensor identifier
     * @return JSON string with command data or error
     */
    external fun getInitialWrite(sensorId: String): String

    /**
     * Handle a notification payload from the sensor.
     *
     * @param sensorId Sensor identifier
     * @param payload Raw notification payload bytes
     * @param timestampMs Timestamp when notification was received
     * @return JSON string with processed data or error
     */
    external fun handleNotification(sensorId: String, payload: ByteArray, timestampMs: Long): String

    /**
     * Result wrapper for bridge operations.
     */
    sealed class Result<out T> {
        data class Success<T>(val value: T) : Result<T>()
        data class Error(val message: String) : Result<Nothing>()
    }

    /**
     * Parse JSON result from native bridge.
     * This is a simplified parser - in production, use a proper JSON library.
     */
    fun parseJsonResult(json: String): Result<Map<String, Any>> {
        return try {
            if (json.contains("\"error\"")) {
                val errorStart = json.indexOf("\"error\"") + 9
                val errorEnd = json.indexOf("\"", errorStart)
                val error = json.substring(errorStart, errorEnd)
                Result.Error(error)
            } else {
                // Simple parsing for success case - extract key-value pairs
                val result = mutableMapOf<String, Any>()
                // This is a placeholder - real implementation would use proper JSON parsing
                result["raw"] = json
                Result.Success(result)
            }
        } catch (e: Exception) {
            Result.Error("Failed to parse result: ${e.message}")
        }
    }
}

package com.berdegeus.glucore

import android.content.Context
import android.util.Log
import org.json.JSONException
import org.json.JSONObject
import java.util.Locale

/**
 * Glucore-owned adapter around the JNI bridge.
 *
 * This is the only Kotlin layer that should deal with raw native payloads.
 * It keeps proprietary/Juggluco-derived details isolated from the rest of the
 * Android implementation and converts bridge calls into typed session results.
 */
class SibionicsNativeBridgeAdapter(private val context: Context) {

    sealed class CallResult<out T> {
        data class Success<T>(val value: T, val rawPayload: String? = null) : CallResult<T>()
        data class NoData(val rawPayload: String? = null) : CallResult<Nothing>()
        data class Error(
            val message: String,
            val rawPayload: String? = null,
            val cause: Throwable? = null
        ) : CallResult<Nothing>()
    }

    private var bridgeInitState: CallResult<Unit>? = null

    fun initializeIfNeeded(): CallResult<Unit> {
        bridgeInitState?.let { return it }

        return try {
            val filesDir = context.filesDir.absolutePath
            val nativeLibraryDir = context.applicationInfo.nativeLibraryDir.orEmpty()
            val countryCode = resolveCountryCode()
            Log.i(TAG, "Initializing native bridge with nativeLibraryDir=$nativeLibraryDir")
            val initCode = GlucoreSibionicsBridge.init(filesDir, nativeLibraryDir, countryCode)

            val result = if (initCode == 0) {
                CallResult.Success(Unit)
            } else {
                val detail = GlucoreSibionicsBridge.getLastError().trim()
                val suffix = if (detail.isBlank()) "" else ": $detail"
                CallResult.Error("Native bridge init failed with code $initCode$suffix")
            }
            bridgeInitState = result
            result
        } catch (t: Throwable) {
            val result = CallResult.Error(
                message = "Native bridge init threw ${t::class.java.simpleName}: ${t.message ?: "unknown"}",
                cause = t
            )
            bridgeInitState = result
            result
        }
    }

    fun registerSensor(barcode: String, subtype: Int = SENSOR_SUBTYPE_STANDARD): CallResult<SensorSessionSnapshot> {
        when (val initResult = initializeIfNeeded()) {
            is CallResult.Error -> return initResult
            else -> Unit
        }

        return try {
            val rawPayload = GlucoreSibionicsBridge.registerSensor(barcode, subtype)
            parseSessionPayload(rawPayload, fallbackSensorId = barcode, allowNoData = false)
        } catch (t: Throwable) {
            CallResult.Error(
                message = "Native registerSensor call failed: ${t.message ?: "unknown"}",
                cause = t
            )
        }
    }

    fun restoreActiveSensor(): CallResult<SensorSessionSnapshot> {
        when (val initResult = initializeIfNeeded()) {
            is CallResult.Error -> return initResult
            else -> Unit
        }

        return try {
            val rawPayload = GlucoreSibionicsBridge.restoreActiveSensor()
            parseSessionPayload(rawPayload, fallbackSensorId = null, allowNoData = true)
        } catch (t: Throwable) {
            CallResult.Error(
                message = "Native restoreActiveSensor call failed: ${t.message ?: "unknown"}",
                cause = t
            )
        }
    }

    private fun parseSessionPayload(
        rawPayload: String?,
        fallbackSensorId: String?,
        allowNoData: Boolean
    ): CallResult<SensorSessionSnapshot> {
        val payload = rawPayload?.trim().orEmpty()
        if (payload.isEmpty() || payload == "null") {
            return if (allowNoData) CallResult.NoData(rawPayload) else CallResult.Error(
                "Native bridge returned an empty payload",
                rawPayload
            )
        }

        val root = try {
            JSONObject(payload)
        } catch (_: JSONException) {
            val rawSensorId = when {
                looksLikeSensorBarcode(payload) -> payload
                fallbackSensorId != null -> fallbackSensorId
                else -> null
            }

            return if (rawSensorId != null) {
                CallResult.Success(
                    value = SensorSessionSnapshot(sensorId = rawSensorId, connected = false),
                    rawPayload = rawPayload
                )
            } else {
                CallResult.Error("Native bridge returned a non-JSON payload", rawPayload)
            }
        }

        extractError(root)?.let { error ->
            if (allowNoData && looksLikeNoActiveSession(error)) {
                return CallResult.NoData(rawPayload)
            }
            return CallResult.Error(error, rawPayload)
        }

        if (allowNoData && indicatesNoActiveSession(root)) {
            return CallResult.NoData(rawPayload)
        }

        val sessionObject = sessionObject(root)
        val sensorId = extractString(sessionObject, SESSION_ID_KEYS)
            ?: extractString(root, SESSION_ID_KEYS)
            ?: fallbackSensorId

        if (sensorId.isNullOrBlank()) {
            return if (allowNoData) {
                CallResult.NoData(rawPayload)
            } else {
                CallResult.Error("Native bridge did not return a sensor identifier", rawPayload)
            }
        }

        val transmitterId = extractString(sessionObject, TRANSMITTER_ID_KEYS)
            ?: extractString(root, TRANSMITTER_ID_KEYS)
        val connected = extractBoolean(sessionObject, CONNECTED_KEYS)
            ?: extractBoolean(root, CONNECTED_KEYS)
            ?: false
        val libreVersion = extractInt(sessionObject, LIBRE_VERSION_KEYS)
            ?: extractInt(root, LIBRE_VERSION_KEYS)

        return CallResult.Success(
            value = SensorSessionSnapshot(
                sensorId = sensorId,
                transmitterId = transmitterId,
                connected = connected,
                brand = libreVersion?.let { SensorBrand.fromLibreVersion(it) }
                    ?: SensorBrand.SIBIONICS
            ),
            rawPayload = rawPayload
        )
    }

    private fun sessionObject(root: JSONObject): JSONObject {
        for (key in NESTED_SESSION_KEYS) {
            root.optJSONObject(key)?.let { return it }
        }
        return root
    }

    private fun extractError(root: JSONObject): String? {
        if (root.has(ERROR_KEY) && !root.isNull(ERROR_KEY)) {
            val errorValue = root.opt(ERROR_KEY)
            if (errorValue is String && errorValue.isNotBlank()) {
                return errorValue
            }
            if (errorValue is JSONObject) {
                val nestedMessage = extractString(errorValue, ERROR_MESSAGE_KEYS)
                if (!nestedMessage.isNullOrBlank()) {
                    return nestedMessage
                }
            }
        }

        val status = extractString(root, STATUS_KEYS)?.lowercase(Locale.US)
        if (status == "error") {
            return extractString(root, ERROR_MESSAGE_KEYS) ?: "Native bridge reported an error"
        }

        return null
    }

    private fun extractString(json: JSONObject, keys: Array<String>): String? {
        for (key in keys) {
            if (!json.has(key) || json.isNull(key)) {
                continue
            }
            val value = json.opt(key)
            if (value is String && value.isNotBlank()) {
                return value
            }
            if (value != null && value != JSONObject.NULL) {
                return value.toString()
            }
        }
        return null
    }

    private fun extractInt(json: JSONObject, keys: Array<String>): Int? {
        for (key in keys) {
            if (!json.has(key) || json.isNull(key)) {
                continue
            }
            when (val value = json.opt(key)) {
                is Number -> return value.toInt()
                is String -> value.toIntOrNull()?.let { return it }
            }
        }
        return null
    }

    private fun extractBoolean(json: JSONObject, keys: Array<String>): Boolean? {
        for (key in keys) {
            if (!json.has(key) || json.isNull(key)) {
                continue
            }
            val value = json.opt(key)
            when (value) {
                is Boolean -> return value
                is Number -> return value.toInt() != 0
                is String -> {
                    when (value.lowercase(Locale.US)) {
                        "true", "1", "connected", "active" -> return true
                        "false", "0", "disconnected", "inactive" -> return false
                    }
                }
            }
        }
        return null
    }

    private fun looksLikeNoActiveSession(message: String): Boolean {
        val normalized = message.lowercase(Locale.US)
        return normalized.contains("no active")
            || normalized.contains("not found")
            || normalized.contains("no sensor")
            || normalized.contains("empty")
    }

    private fun indicatesNoActiveSession(root: JSONObject): Boolean {
        val active = extractBoolean(root, ACTIVE_KEYS)
        if (active == false) {
            return true
        }

        val status = extractString(root, STATUS_KEYS)?.lowercase(Locale.US)
        return status == "none"
            || status == "empty"
            || status == "missing"
            || status == "not_found"
            || status == "notfound"
    }

    private fun resolveCountryCode(): String {
        val localeCountry = Locale.getDefault().country.orEmpty().uppercase(Locale.US)
        return if (localeCountry.isBlank()) DEFAULT_COUNTRY_CODE else localeCountry
    }

    private fun looksLikeSensorBarcode(value: String): Boolean {
        val trimmed = value.trim()
        return trimmed.isNotEmpty()
            && trimmed.none { it.isWhitespace() }
            && trimmed.all { it.isLetterOrDigit() || it == '-' || it == '_' }
    }

    companion object {
        private const val TAG = "SibionicsBridge"
        private const val SENSOR_SUBTYPE_STANDARD = 0
        private const val DEFAULT_COUNTRY_CODE = "US"

        private val SESSION_ID_KEYS = arrayOf(
            "sensorId",
            "sensor_id",
            "sensorBarcode",
            "sensor_barcode",
            "barcode",
            "id"
        )
        private val TRANSMITTER_ID_KEYS = arrayOf(
            "transmitterId",
            "transmitter_id",
            "transmitterBarcode",
            "transmitter_barcode",
            "deviceId",
            "device_id"
        )
        private val CONNECTED_KEYS = arrayOf("connected", "isConnected", "is_connected")
        private val LIBRE_VERSION_KEYS = arrayOf("libreVersion", "libre_version")
        private val ACTIVE_KEYS = arrayOf("active", "hasActiveSensor", "has_active_sensor")
        private val STATUS_KEYS = arrayOf("status", "state", "result")
        private const val ERROR_KEY = "error"
        private val ERROR_MESSAGE_KEYS = arrayOf("message", "detail", "reason", "error")
        private val NESTED_SESSION_KEYS = arrayOf("session", "sensor", "data", "result")
    }
}

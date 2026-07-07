package com.berdegeus.glucore

import android.os.Handler
import android.os.Looper
import tk.glucodata.Natives

data class WarmupPayload(val elapsedMs: Long, val totalMs: Long)
data class GlucoseReadingPayload(val value: Double)
data class FailurePayload(val message: String)

class SensorPlatformImpl(
    private val sessionManager: SensorSessionManager,
    private val nativeBridgeAdapter: SibionicsNativeBridgeAdapter
) {
    private var eventSink: io.flutter.plugin.common.EventChannel.EventSink? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var bleManager: SibionicsBleManager? = null

    /**
     * When set (by SensorCore), every event emitted here is routed through it
     * instead of going straight to the sink, so the core can record the last
     * event before forwarding it via [deliverEventToSink].
     */
    var eventDispatcher: ((Map<String, Any?>) -> Unit)? = null

    fun setBleManager(manager: SibionicsBleManager) {
        bleManager = manager
    }

    fun initializeNativeBridge() {
        nativeBridgeAdapter.initializeIfNeeded()
        // libg.so is loaded by the C++ bridge via dlopen(RTLD_GLOBAL). We also
        // load it here via System.loadLibrary so Android's JNI resolver can find
        // Java_tk_glucodata_Natives_* symbols for direct Kotlin→JNI calls.
        // Calling loadLibrary on an already-loaded .so is a no-op on Android.
        try {
            System.loadLibrary("g")
        } catch (e: UnsatisfiedLinkError) {
            android.util.Log.w("SensorPlatformImpl", "System.loadLibrary(g): ${e.message}")
        }
    }

    fun restoreSession(): Map<String, Any?>? {
        if (sessionManager.getCurrentSession() == null) return null

        return when (val result = nativeBridgeAdapter.restoreActiveSensor()) {
            is SibionicsNativeBridgeAdapter.CallResult.Success -> {
                val snapshot = sessionManager.syncSessionFromNative(result.value)
                snapshot.toPlatformMap()
            }
            is SibionicsNativeBridgeAdapter.CallResult.NoData -> {
                sessionManager.clearSession()
                null
            }
            is SibionicsNativeBridgeAdapter.CallResult.Error -> {
                throw IllegalStateException(result.message, result.cause)
            }
        }
    }

    /**
     * Registers a sensor synchronously. Returns the session snapshot map on
     * success (also emitted as an `idle` event) and throws
     * [IllegalStateException] on failure (also emitted as an `error` event),
     * so the MethodChannel caller gets an immediate result even if the
     * EventChannel is not subscribed yet.
     */
    fun registerSensor(barcode: String): Map<String, Any?>? {
        val validation = SibionicsBarcode.validateSensorBarcode(barcode)
        if (validation is SibionicsBarcode.Result.Error) {
            val message = "Registration failed: ${validation.message}"
            emitError(message)
            throw IllegalStateException(message)
        }

        val normalizedBarcode = (validation as SibionicsBarcode.Result.Valid).barcode

        when (val result = nativeBridgeAdapter.registerSensor(normalizedBarcode)) {
            is SibionicsNativeBridgeAdapter.CallResult.Success -> {
                val snapshot = sessionManager.syncSessionFromNative(result.value)
                // Sensor registered — connection happens when startMonitoring() is called
                emitEvent(status = "idle", session = snapshot, connected = false)
                return snapshot.toPlatformMap()
            }
            is SibionicsNativeBridgeAdapter.CallResult.NoData -> {
                val message = "Registration failed: native bridge returned no session"
                emitError(message)
                throw IllegalStateException(message)
            }
            is SibionicsNativeBridgeAdapter.CallResult.Error -> {
                val message = "Registration failed: ${result.message}"
                emitError(message)
                throw IllegalStateException(message)
            }
        }
    }

    fun submitTransmitter(transmitterBarcode: String) {
        sessionManager.submitTransmitter(transmitterBarcode)
            .onFailure { emitError("Transmitter submission failed: ${it.message}") }
    }

    /** Returns true when the BLE scan actually started (monitoring is live). */
    fun startMonitoring(): Boolean {
        if (sessionManager.getCurrentSession() == null) {
            emitError("No sensor registered")
            return false
        }

        val sensors = try { Natives.activeSensors() } catch (e: Exception) {
            emitError("activeSensors() failed: ${e.message}")
            return false
        }

        if (sensors.isNullOrEmpty()) {
            emitError("No active sensor in native bridge — register the sensor first")
            return false
        }

        val dataptr = try { Natives.getdataptr(sensors[0]) } catch (e: Exception) {
            emitError("getdataptr() failed: ${e.message}")
            return false
        }

        if (dataptr == 0L) {
            emitError("Native dataptr is 0 — sensor state not initialized")
            return false
        }

        val bm = bleManager
        if (bm == null) {
            emitError("BleManager not initialized")
            return false
        }

        sessionManager.startMonitoring()
            .onFailure { emitError("startMonitoring: ${it.message}"); return false }

        bm.startSensorScan(dataptr)
            .onFailure { emitError(it.message ?: "BLE scan failed"); return false }
        return true
    }

    fun stopMonitoring() {
        bleManager?.stopScan()
        bleManager?.disconnect()
        sessionManager.stopMonitoring()
        emitEvent(status = "disconnected", connected = false)
    }

    fun clearSession() {
        stopMonitoring()
        sessionManager.clearSession()
            .onSuccess { emitEvent(status = "idle") }
    }

    fun setEventSink(sink: io.flutter.plugin.common.EventChannel.EventSink?) {
        eventSink = sink
    }

    internal fun emitEventMap(event: Map<String, Any?>) {
        val dispatcher = eventDispatcher
        if (dispatcher != null) {
            dispatcher(event)
        } else {
            deliverEventToSink(event)
        }
    }

    /** Delivers an event to the Flutter sink on the main thread (no dispatcher). */
    internal fun deliverEventToSink(event: Map<String, Any?>) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            eventSink?.success(event)
        } else {
            mainHandler.post { eventSink?.success(event) }
        }
    }

    private fun emitEvent(
        status: String,
        session: SensorSessionSnapshot? = null,
        connected: Boolean = false,
        warmup: WarmupPayload? = null,
        reading: GlucoseReadingPayload? = null,
        failure: FailurePayload? = null
    ) {
        emitEventMap(mapOf(
            "status" to status,
            "session" to session?.let {
                mapOf("sensorId" to it.sensorId, "transmitterId" to it.transmitterId)
            },
            "connected" to connected,
            "warmup" to warmup?.let { mapOf("elapsedMs" to it.elapsedMs, "totalMs" to it.totalMs) },
            "reading" to reading?.let { mapOf("value" to it.value) },
            "failure" to failure?.let { mapOf("message" to it.message) }
        ))
    }

    private fun emitError(message: String) {
        emitEvent(status = "error", failure = FailurePayload(message))
    }

    private fun SensorSessionSnapshot.toPlatformMap(): Map<String, Any?> =
        mapOf("sensorId" to sensorId, "transmitterId" to transmitterId, "connected" to connected)
}

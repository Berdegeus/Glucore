package com.berdegeus.glucore

import android.os.Handler
import android.os.Looper
import tk.glucodata.Natives

data class GlucoseReadingPayload(val value: Double)
data class FailurePayload(val message: String)

class SensorPlatformImpl(
    private val sessionManager: SensorSessionManager,
    private val nativeBridgeAdapter: SibionicsNativeBridgeAdapter
) {
    private var eventSink: io.flutter.plugin.common.EventChannel.EventSink? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    /** Resolves the BLE manager for a brand; null when the brand is unsupported. */
    private var bleManagerProvider: ((SensorBrand) -> BrandBleManager?)? = null

    /** Manager currently scanning/connected — the single-active-sensor invariant. */
    private var activeBleManager: BrandBleManager? = null

    /**
     * When set (by SensorCore), every event emitted here is routed through it
     * instead of going straight to the sink, so the core can record the last
     * event before forwarding it via [deliverEventToSink].
     */
    var eventDispatcher: ((Map<String, Any?>) -> Unit)? = null

    fun setBleManagerProvider(provider: (SensorBrand) -> BrandBleManager?) {
        bleManagerProvider = provider
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
                // The restore payload does not carry the brand; keep the one
                // persisted with the session instead of the SIBIONICS default.
                val persistedBrand = sessionManager.getCurrentSession()?.brand
                val snapshot = sessionManager.syncSessionFromNative(
                    if (persistedBrand != null) result.value.copy(brand = persistedBrand)
                    else result.value
                )
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
    fun registerSensor(
        barcode: String,
        requestedBrand: SensorBrand = SensorBrand.SIBIONICS
    ): Map<String, Any?>? {
        val validation = SibionicsBarcode.validateSensorBarcode(barcode)
        if (validation is SibionicsBarcode.Result.Error) {
            val message = "Registration failed: ${validation.message}"
            emitError(message)
            throw IllegalStateException(message)
        }

        val normalizedBarcode = (validation as SibionicsBarcode.Result.Valid).barcode

        // Single active sensor: registering a new one ends the previous
        // session (stop its BLE activity before the row is overwritten).
        if (sessionManager.getCurrentSession() != null) {
            activeBleManager?.stopScan()
            activeBleManager?.disconnect()
            activeBleManager = null
        }

        when (val result = nativeBridgeAdapter.registerSensor(normalizedBarcode)) {
            is SibionicsNativeBridgeAdapter.CallResult.Success -> {
                if (result.value.brand != requestedBrand) {
                    android.util.Log.w(
                        "SensorPlatformImpl",
                        "Native detected brand ${result.value.brand.wireName} " +
                            "but UI requested ${requestedBrand.wireName}; native wins"
                    )
                }
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

    /**
     * Registers a Libre 2 sensor discovered over NFC. `Natives.nfcdata` has
     * already persisted it in libg's store; this records the local session
     * (ending any previous one) and announces it to Flutter.
     */
    fun registerNfcSensor(serial: String) {
        activeBleManager?.stopScan()
        activeBleManager?.disconnect()
        activeBleManager = null
        val snapshot = sessionManager.syncSessionFromNative(
            SensorSessionSnapshot(
                sensorId = serial,
                connected = false,
                brand = SensorBrand.LIBRE2
            )
        )
        emitEvent(status = "idle", session = snapshot, connected = false)
    }

    /** Returns true when the BLE scan actually started (monitoring is live). */
    fun startMonitoring(): Boolean {
        val session = sessionManager.getCurrentSession()
        if (session == null) {
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

        // The native store can hold sensors from earlier registrations; prefer
        // the one matching the persisted session (single-sensor invariant).
        val sensorName = sensors.firstOrNull { it == session.sensorId } ?: sensors[0]

        val dataptr = try { Natives.getdataptr(sensorName) } catch (e: Exception) {
            emitError("getdataptr() failed: ${e.message}")
            return false
        }

        if (dataptr == 0L) {
            emitError("Native dataptr is 0 — sensor state not initialized")
            return false
        }

        val brand = resolveBrand(dataptr, session.brand)
        val bm = bleManagerProvider?.invoke(brand)
        if (bm == null) {
            emitError("No BLE support for sensor brand ${brand.wireName}")
            return false
        }

        // Single active sensor: silence any manager left over from a
        // different brand before handing the radio to the new one.
        activeBleManager?.takeIf { it !== bm }?.let {
            it.stopScan()
            it.disconnect()
        }
        activeBleManager = bm

        sessionManager.startMonitoring()
            .onFailure { emitError("startMonitoring: ${it.message}"); return false }

        bm.startSensorScan(dataptr)
            .onFailure { emitError(it.message ?: "BLE scan failed"); return false }
        return true
    }

    fun stopMonitoring() {
        activeBleManager?.stopScan()
        activeBleManager?.disconnect()
        sessionManager.stopMonitoring()
        emitEvent(status = "disconnected", connected = false)
    }

    /**
     * The native type code is authoritative (same convention as Juggluco's
     * callback factory); the session's persisted brand is the fallback when
     * the native call is unavailable.
     */
    private fun resolveBrand(dataptr: Long, persisted: SensorBrand): SensorBrand {
        return try {
            SensorBrand.fromLibreVersion(Natives.getLibreVersion(dataptr))
        } catch (e: Throwable) {
            android.util.Log.w(
                "SensorPlatformImpl",
                "getLibreVersion failed (${e.message}); using persisted brand ${persisted.wireName}"
            )
            persisted
        }
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
        reading: GlucoseReadingPayload? = null,
        failure: FailurePayload? = null
    ) {
        emitEventMap(mapOf(
            "status" to status,
            "session" to session?.let {
                mapOf(
                    "sensorId" to it.sensorId,
                    "brand" to it.brand.wireName
                )
            },
            "brand" to (session?.brand ?: sessionManager.getCurrentSession()?.brand)?.wireName,
            "connected" to connected,
            // The BLE path never produces warmup progress; the Libre 2 NFC path
            // signals warmup through the `nfc` field with status `warmingUp`.
            "warmup" to null,
            "reading" to reading?.let { mapOf("value" to it.value) },
            "failure" to failure?.let { mapOf("message" to it.message) }
        ))
    }

    private fun emitError(message: String) {
        emitEvent(status = "error", failure = FailurePayload(message))
    }

    private fun SensorSessionSnapshot.toPlatformMap(): Map<String, Any?> =
        mapOf(
            "sensorId" to sensorId,
            "connected" to connected,
            "brand" to brand.wireName
        )
}

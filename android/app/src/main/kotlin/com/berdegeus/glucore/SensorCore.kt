package com.berdegeus.glucore

import android.content.Context
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.EventChannel
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Application-scoped owner of the entire sensor stack.
 *
 * Constructed lazily by [GlucoreApp], so the BLE session survives Activity
 * (and Flutter engine) teardown. MainActivity only registers the platform
 * channels and delegates every call here; [CgmForegroundService] keeps the
 * process alive while monitoring and observes events for its notification.
 *
 * Every event — from [SibionicsBleManager] and from [SensorPlatformImpl]'s
 * own emissions — flows through [dispatchEvent], which records the last event
 * (replayed to late EventChannel subscribers) before forwarding it to the
 * Flutter sink and to registered listeners.
 */
class SensorCore(context: Context) {

    private val appContext: Context = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())

    private val sessionManager = SensorSessionManager(appContext)
    private val nativeBridgeAdapter = SibionicsNativeBridgeAdapter(appContext)
    private val platform = SensorPlatformImpl(sessionManager, nativeBridgeAdapter)

    // One BLE manager per brand, created on first use; all share the event
    // funnel. SensorPlatformImpl enforces that only one is active at a time.
    private val bleManagers = mutableMapOf<SensorBrand, BrandBleManager>()

    private fun bleManagerFor(brand: SensorBrand): BrandBleManager? =
        when (brand) {
            SensorBrand.SIBIONICS -> bleManagers.getOrPut(brand) {
                SibionicsBleManager(appContext) { event -> dispatchEvent(event) }
            }
            SensorBrand.ACCUCHEK -> bleManagers.getOrPut(brand) {
                AccuChekBleManager(appContext) { event -> dispatchEvent(event) }
            }
            // Implemented in a later phase.
            SensorBrand.LIBRE2 -> null
        }

    /** Last event dispatched, replayed when a new EventChannel listener attaches. */
    @Volatile
    var lastEvent: Map<String, Any?>? = null
        private set

    private val listeners = CopyOnWriteArraySet<(Map<String, Any?>) -> Unit>()

    init {
        platform.eventDispatcher = ::dispatchEvent
        platform.setBleManagerProvider(::bleManagerFor)
        platform.initializeNativeBridge()
    }

    /** Single funnel for all sensor events: record, forward to sink, notify listeners. */
    fun dispatchEvent(event: Map<String, Any?>) {
        lastEvent = event
        platform.deliverEventToSink(event)
        for (listener in listeners) {
            listener(event)
        }
    }

    /** Registers an out-of-band event observer (e.g. the foreground service notification). */
    fun addEventListener(listener: (Map<String, Any?>) -> Unit) {
        listeners.add(listener)
    }

    fun removeEventListener(listener: (Map<String, Any?>) -> Unit) {
        listeners.remove(listener)
    }

    // ── MethodChannel delegates ───────────────────────────────────────────────

    fun restoreSession(): Map<String, Any?>? = platform.restoreSession()

    fun registerSensor(
        barcode: String,
        requestedBrand: SensorBrand = SensorBrand.SIBIONICS
    ): Map<String, Any?>? = platform.registerSensor(barcode, requestedBrand)

    fun submitTransmitter(transmitterBarcode: String) = platform.submitTransmitter(transmitterBarcode)

    fun startMonitoring() {
        if (platform.startMonitoring()) {
            CgmForegroundService.start(appContext)
        }
    }

    fun stopMonitoring() {
        platform.stopMonitoring()
        CgmForegroundService.stop(appContext)
    }

    fun clearSession() {
        platform.clearSession()
        CgmForegroundService.stop(appContext)
    }

    /** True when the cached session says monitoring was active (used after process restart). */
    fun hasConnectedSession(): Boolean =
        sessionManager.getCurrentSession()?.status ==
            SibionicsSessionRecord.SessionStatus.CONNECTED

    // ── EventChannel wiring ───────────────────────────────────────────────────

    /**
     * Attaches/detaches the Flutter event sink. When a sink attaches and a
     * last event exists, it is replayed immediately on the main thread so late
     * subscribers never miss the current state (ARCHITECTURE_REVIEW §P10).
     */
    fun setEventSink(sink: EventChannel.EventSink?) {
        platform.setEventSink(sink)
        if (sink == null) return
        val replay = lastEvent ?: return
        if (Looper.myLooper() == Looper.getMainLooper()) {
            sink.success(replay)
        } else {
            mainHandler.post { sink.success(replay) }
        }
    }
}

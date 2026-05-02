package com.berdegeus.glucore

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "glucore/sensor/methods"
    private val EVENT_CHANNEL = "glucore/sensor/events"
    private lateinit var sensorImpl: SensorPlatformImpl

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        val sessionManager = SensorSessionManager(this)
        val nativeBridgeAdapter = SibionicsNativeBridgeAdapter(this)
        sensorImpl = SensorPlatformImpl(sessionManager, nativeBridgeAdapter)
        sensorImpl.initializeNativeBridge()

        val bleManager = SibionicsBleManager(this) { event -> sensorImpl.emitEventMap(event) }
        sensorImpl.setBleManager(bleManager)

        requestBlePermissionsIfNeeded()

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "restoreSession" -> result.success(sensorImpl.restoreSession())
                        "registerSensor" -> {
                            val barcode = call.argument<String>("barcode") ?: ""
                            sensorImpl.registerSensor(barcode)
                            result.success(null)
                        }
                        "submitTransmitter" -> {
                            val transmitterBarcode = call.argument<String>("transmitterBarcode") ?: ""
                            sensorImpl.submitTransmitter(transmitterBarcode)
                            result.success(null)
                        }
                        "startMonitoring" -> {
                            sensorImpl.startMonitoring()
                            result.success(null)
                        }
                        "stopMonitoring" -> {
                            sensorImpl.stopMonitoring()
                            result.success(null)
                        }
                        "clearSession" -> {
                            sensorImpl.clearSession()
                            result.success(null)
                        }
                        else -> result.notImplemented()
                    }
                } catch (e: Exception) {
                    result.error("NATIVE_ERROR", e.message, null)
                }
            }

        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    sensorImpl.setEventSink(events)
                }
                override fun onCancel(arguments: Any?) {
                    sensorImpl.setEventSink(null)
                }
            })
    }

    private fun requestBlePermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val needed = mutableListOf<String>()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED)
            needed.add(Manifest.permission.BLUETOOTH_SCAN)
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED)
            needed.add(Manifest.permission.BLUETOOTH_CONNECT)
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION)
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), 1001)
        }
    }
}

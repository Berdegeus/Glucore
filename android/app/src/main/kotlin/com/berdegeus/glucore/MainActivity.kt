package com.berdegeus.glucore

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

/**
 * Thin channel host. The sensor stack lives in [SensorCore] (owned by
 * [GlucoreApp]); this activity only registers the two platform channels and
 * delegates every call, so BLE monitoring survives activity teardown.
 */
class MainActivity : FlutterActivity() {
    private val CHANNEL = "glucore/sensor/methods"
    private val EVENT_CHANNEL = "glucore/sensor/events"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        val core = (application as GlucoreApp).sensorCore

        requestRuntimePermissionsIfNeeded()

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "restoreSession" -> result.success(core.restoreSession())
                        "registerSensor" -> {
                            val barcode = call.argument<String>("barcode") ?: ""
                            result.success(core.registerSensor(barcode))
                        }
                        "submitTransmitter" -> {
                            val transmitterBarcode = call.argument<String>("transmitterBarcode") ?: ""
                            core.submitTransmitter(transmitterBarcode)
                            result.success(null)
                        }
                        "startMonitoring" -> {
                            core.startMonitoring()
                            result.success(null)
                        }
                        "stopMonitoring" -> {
                            core.stopMonitoring()
                            result.success(null)
                        }
                        "clearSession" -> {
                            core.clearSession()
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
                    core.setEventSink(events)
                }
                override fun onCancel(arguments: Any?) {
                    core.setEventSink(null)
                }
            })
    }

    private fun requestRuntimePermissionsIfNeeded() {
        val needed = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.BLUETOOTH_SCAN)
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.BLUETOOTH_CONNECT)
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), 1001)
        }
    }
}

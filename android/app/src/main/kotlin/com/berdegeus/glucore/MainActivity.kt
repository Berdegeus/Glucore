package com.berdegeus.glucore

import android.Manifest
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.os.Build
import android.os.Bundle
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

    // Libre 2 NFC scan (reader mode is activity-scoped; re-enabled on resume
    // while a scan is pending).
    private var nfcScanRequested = false

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
                            val brand = SensorBrand.fromWireName(call.argument<String>("brand"))
                            result.success(core.registerSensor(barcode, brand))
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
                        "getAbbottLibraryStatus" -> result.success(core.abbottLibraryStatus())
                        "installAbbottLibrary" -> {
                            val path = call.argument<String>("path") ?: ""
                            // Zip extraction + native re-init off the main thread.
                            Thread {
                                try {
                                    core.installAbbottLibrary(path)
                                    runOnUiThread { result.success(null) }
                                } catch (e: Exception) {
                                    runOnUiThread {
                                        result.error("NATIVE_ERROR", e.message, null)
                                    }
                                }
                            }.start()
                        }
                        "startNfcScan" -> {
                            startNfcScan()
                            result.success(null)
                        }
                        "stopNfcScan" -> {
                            stopNfcScan()
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

    // ── Libre 2 NFC reader mode ───────────────────────────────────────────────

    private fun startNfcScan() {
        val adapter = NfcAdapter.getDefaultAdapter(this)
        if (adapter == null || !adapter.isEnabled) {
            throw IllegalStateException(
                if (adapter == null) "Este aparelho não tem NFC"
                else "NFC está desativado — ative nas configurações"
            )
        }
        nfcScanRequested = true
        enableReaderMode(adapter)
    }

    private fun stopNfcScan() {
        nfcScanRequested = false
        NfcAdapter.getDefaultAdapter(this)?.disableReaderMode(this)
    }

    private fun enableReaderMode(adapter: NfcAdapter) {
        val options = Bundle().apply {
            putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250)
        }
        adapter.enableReaderMode(
            this,
            { tag ->
                // Reader-mode callback thread: the Libre NFC flow is blocking
                // transceive I/O, so run it right here.
                (application as GlucoreApp).sensorCore.handleLibreTag(tag)
            },
            NfcAdapter.FLAG_READER_NFC_V or
                NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
                NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS,
            options
        )
    }

    override fun onResume() {
        super.onResume()
        if (nfcScanRequested) {
            NfcAdapter.getDefaultAdapter(this)?.takeIf { it.isEnabled }?.let {
                enableReaderMode(it)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        if (nfcScanRequested) {
            NfcAdapter.getDefaultAdapter(this)?.disableReaderMode(this)
        }
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

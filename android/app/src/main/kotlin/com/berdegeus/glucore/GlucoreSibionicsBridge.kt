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
}

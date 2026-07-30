package com.berdegeus.glucore

import android.app.Application

/**
 * Application entry point. Owns the lazily-created [SensorCore] singleton so
 * the sensor stack (session cache, native bridge, BLE manager) lives at the
 * application scope instead of dying with MainActivity.
 */
class GlucoreApp : Application() {

    val sensorCore: SensorCore by lazy { SensorCore(this) }
}

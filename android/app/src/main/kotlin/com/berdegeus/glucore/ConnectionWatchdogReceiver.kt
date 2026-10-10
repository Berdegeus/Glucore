package com.berdegeus.glucore

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log

/**
 * Fires once a minute while monitoring. The BLE reconnect chain runs on the
 * main handler's uptime clock and can stall (or end) without anything noticing;
 * an OS alarm doesn't depend on any of that, so it is the one thing guaranteed
 * to run. It only asks [SensorCore.checkConnection], which decides — see
 * [ConnectionWatchdog] — whether the connection is stuck and needs restarting.
 *
 * Inexact on purpose (`setAndAllowWhileIdle`): no exact-alarm permission, and a
 * delay of a minute or two in deep Doze is harmless against a 3 min threshold.
 */
class ConnectionWatchdogReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val core = (context.applicationContext as GlucoreApp).sensorCore
        core.checkConnection()
        // Keep ticking, but only while the service says monitoring is on: an
        // alarm that fires after stop() must not re-arm itself.
        if (ConnectionWatchdogScheduler.isArmed) {
            ConnectionWatchdogScheduler.schedule(context)
        }
    }
}

object ConnectionWatchdogScheduler {
    private const val TAG = "ConnectionWatchdog"
    const val PERIOD_MS = 60_000L
    private const val REQUEST_CODE = 0x6C1

    @Volatile
    var isArmed = false
        private set

    /** Starts the periodic check; called when monitoring begins. */
    fun arm(context: Context) {
        isArmed = true
        schedule(context)
    }

    /** Stops it for good; called when monitoring ends. */
    fun cancel(context: Context) {
        isArmed = false
        context.getSystemService(AlarmManager::class.java)?.cancel(pendingIntent(context))
    }

    internal fun schedule(context: Context) {
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        try {
            manager.setAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + PERIOD_MS,
                pendingIntent(context)
            )
        } catch (e: Exception) {
            Log.w(TAG, "could not schedule: ${e.message}")
        }
    }

    private fun pendingIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, ConnectionWatchdogReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
}

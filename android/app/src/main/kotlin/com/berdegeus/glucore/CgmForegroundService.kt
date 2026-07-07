package com.berdegeus.glucore

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Foreground service that keeps the process alive while CGM monitoring is
 * active and surfaces the connection status + last glucose value in a
 * persistent notification.
 *
 * It does NOT own the sensor stack — [SensorCore] (application-scoped) does.
 * The service only observes SensorCore events to update its notification and,
 * after a restart-by-the-system (START_STICKY, null intent), re-triggers
 * monitoring when the cached session says it was active.
 */
class CgmForegroundService : Service() {

    companion object {
        private const val TAG = "CgmForegroundService"
        private const val CHANNEL_ID = "cgm_monitoring"
        private const val NOTIFICATION_ID = 0x6C0

        fun start(context: Context) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, CgmForegroundService::class.java)
            )
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, CgmForegroundService::class.java))
        }
    }

    private lateinit var core: SensorCore
    private var statusText: String = "Conectando ao sensor…"
    private var readingText: String? = null
    private var inForeground = false

    private val eventListener: (Map<String, Any?>) -> Unit = { event -> onSensorEvent(event) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        core = (application as GlucoreApp).sensorCore
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        goForeground()
        core.addEventListener(eventListener)

        if (intent == null) {
            // Restarted by the system after a process kill. Resume monitoring
            // only when the cached session says it was active.
            if (core.hasConnectedSession()) {
                Log.i(TAG, "Restarted after process kill; resuming monitoring")
                try {
                    core.restoreSession()
                } catch (e: Exception) {
                    Log.w(TAG, "restoreSession after restart failed: ${e.message}")
                }
                core.startMonitoring()
            } else {
                Log.i(TAG, "Restarted with no active session; stopping")
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        core.removeEventListener(eventListener)
        inForeground = false
        super.onDestroy()
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun goForeground() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        inForeground = true
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Monitoramento CGM",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Status da conexão com o sensor e última glicose"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(statusText)
            .setContentText(readingText ?: "Aguardando leituras do sensor")
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun updateNotification() {
        if (!inForeground) return
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIFICATION_ID, buildNotification())
    }

    // ── SensorCore events ─────────────────────────────────────────────────────

    private fun onSensorEvent(event: Map<String, Any?>) {
        val status = event["status"]?.toString() ?: return
        statusText = when (status) {
            "scanning" -> "Procurando sensor…"
            "connecting" -> "Conectando ao sensor…"
            "connected" -> "Sensor conectado"
            "syncingHistory" -> "Sincronizando histórico…"
            "readingAvailable" -> "Sensor conectado"
            "disconnected" -> "Sensor desconectado"
            "error" -> "Falha na conexão do sensor"
            else -> statusText
        }

        val reading = event["reading"] as? Map<*, *>
        if (reading != null) {
            val value = (reading["value"] as? Number)?.toDouble()
            val timestampMs = (reading["timestampMs"] as? Number)?.toLong()
            if (value != null) {
                val time = timestampMs?.let {
                    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(it))
                }
                readingText = if (time != null) {
                    "Última glicose: ${value.toInt()} mg/dL às $time"
                } else {
                    "Última glicose: ${value.toInt()} mg/dL"
                }
            }
        }

        updateNotification()
    }
}

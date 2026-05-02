package com.berdegeus.glucore

import android.content.Context
import android.content.SharedPreferences
import com.berdegeus.glucore.SibionicsSessionRecord.SessionStatus
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream

/**
 * Manages the locally cached Sibionics session state with lightweight Android persistence.
 *
 * Responsibilities:
 * - Mirror bridge-backed session state for the active Android implementation
 * - Persist the latest known session snapshot for Glucore runtime state
 * - Track local monitoring lifecycle state for the current session
 * - Generate snapshots for Flutter layer
 * - Manage local session lifecycle transitions (assign transmitter, connect, disconnect, clear)
 *
 * This manager is not the authority for native registration or native restore.
 * Those operations now flow through the JNI bridge adapter first and then sync
 * the resulting session into this local cache.
 */
class SensorSessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private var currentSession: SibionicsSessionRecord? = null

    init {
        // Load persisted session on initialization
        currentSession = loadSessionFromPrefs()
    }

    fun syncSessionFromNative(snapshot: SensorSessionSnapshot): SensorSessionSnapshot {
        val connectedAtMs = if (snapshot.connected) System.currentTimeMillis() else null
        val status = when {
            snapshot.connected -> SessionStatus.CONNECTED
            !snapshot.transmitterId.isNullOrBlank() -> SessionStatus.TRANSMITTER_ASSIGNED
            else -> SessionStatus.REGISTERED
        }

        val session = SibionicsSessionRecord(
            sensorId = snapshot.sensorId,
            transmitterId = snapshot.transmitterId,
            status = status,
            connectedAtMs = connectedAtMs
        )
        currentSession = session
        persistSession(session)
        return session.toSnapshot()
    }

    /**
     * Submit transmitter barcode for the current session.
     * Session must already exist from native registration or native restore.
     */
    fun submitTransmitter(transmitterBarcode: String): Result<SensorSessionSnapshot> {
        val session = currentSession ?: return Result.failure(Exception("No active sensor session"))
        
        val validation = SibionicsBarcode.validateTransmitterBarcode(transmitterBarcode)
        
        return when (validation) {
            is SibionicsBarcode.Result.Error -> Result.failure(Exception(validation.message))
            is SibionicsBarcode.Result.Valid -> {
                val updated = session.copyWithTransmitter(validation.barcode)
                    .copyWithStatus(SessionStatus.TRANSMITTER_ASSIGNED)
                currentSession = updated
                persistSession(updated)
                Result.success(updated.toSnapshot())
            }
        }
    }

    /**
     * Start monitoring with the current session.
     * Session must be registered (with or without transmitter).
     */
    fun startMonitoring(): Result<Unit> {
        val session = currentSession ?: return Result.failure(Exception("No active sensor registered"))
        
        val updated = session.copyWithStatus(SessionStatus.CONNECTED)
        currentSession = updated
        persistSession(updated)
        return Result.success(Unit)
    }

    /**
     * Stop monitoring disconnects the current session.
     */
    fun stopMonitoring(): Result<Unit> {
        val session = currentSession ?: return Result.failure(Exception("No active session"))
        
        val updated = session.copyWithStatus(SessionStatus.DISCONNECTED)
        currentSession = updated
        persistSession(updated)
        return Result.success(Unit)
    }

    /**
     * Clear the current local session cache - destructive operation.
     *
     * This only clears Glucore's cached runtime state. The current JNI bridge
     * surface does not yet expose a native "clear active sensor" operation, so
     * this does not remove any vendor-managed native session data.
     */
    fun clearSession(): Result<Unit> {
        currentSession = null
        prefs.edit().remove(KEY_CURRENT_SESSION).apply()
        return Result.success(Unit)
    }

    /**
     * Get the current session record (for internal state management).
     */
    fun getCurrentSession(): SibionicsSessionRecord? = currentSession

    // ==================== Persistence ====================

    private fun persistSession(session: SibionicsSessionRecord) {
        try {
            val serialized = serializeSession(session)
            prefs.edit().putString(KEY_CURRENT_SESSION, serialized).apply()
        } catch (e: Exception) {
            // Silently fail on serialization; session remains in memory
            // Next app restart will lose the session, but app stays functional
        }
    }

    private fun loadSessionFromPrefs(): SibionicsSessionRecord? {
        return try {
            val serialized = prefs.getString(KEY_CURRENT_SESSION, null) ?: return null
            deserializeSession(serialized)
        } catch (e: Exception) {
            // If deserialization fails, start fresh
            null
        }
    }

    private fun serializeSession(session: SibionicsSessionRecord): String {
        val baos = ByteArrayOutputStream()
        val oos = ObjectOutputStream(baos)
        oos.writeObject(session)
        oos.close()
        return android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.DEFAULT)
    }

    private fun deserializeSession(encoded: String): SibionicsSessionRecord? {
        val bytes = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT)
        val bais = ByteArrayInputStream(bytes)
        val ois = ObjectInputStream(bais)
        val session = ois.readObject() as SibionicsSessionRecord
        ois.close()
        return session
    }

    companion object {
        private const val PREFS_NAME = "glucore_session_prefs"
        private const val KEY_CURRENT_SESSION = "current_sibionics_session"
    }
}

package com.berdegeus.glucore

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.berdegeus.glucore.SibionicsSessionRecord.SessionStatus

class SensorSessionManager(context: Context) {

    private val db: SQLiteDatabase = SessionDbHelper(context).writableDatabase
    private var currentSession: SibionicsSessionRecord? = null

    init {
        currentSession = loadSessionFromDb()
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
            connectedAtMs = connectedAtMs,
            brand = snapshot.brand
        )
        currentSession = session
        persistSession(session)
        return session.toSnapshot()
    }

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

    fun startMonitoring(): Result<Unit> {
        val session = currentSession ?: return Result.failure(Exception("No active sensor registered"))
        val updated = session.copyWithStatus(SessionStatus.CONNECTED)
        currentSession = updated
        persistSession(updated)
        return Result.success(Unit)
    }

    fun stopMonitoring(): Result<Unit> {
        val session = currentSession ?: return Result.failure(Exception("No active session"))
        val updated = session.copyWithStatus(SessionStatus.DISCONNECTED)
        currentSession = updated
        persistSession(updated)
        return Result.success(Unit)
    }

    fun clearSession(): Result<Unit> {
        currentSession = null
        db.delete(TABLE, "id = 1", null)
        return Result.success(Unit)
    }

    fun getCurrentSession(): SibionicsSessionRecord? = currentSession

    // ── persistence ───────────────────────────────────────────────────────────

    private fun persistSession(session: SibionicsSessionRecord) {
        val values = ContentValues().apply {
            put("id", 1)
            put("sensor_id", session.sensorId)
            put("transmitter_id", session.transmitterId)
            put("status", session.status.name)
            put("connected_at_ms", session.connectedAtMs)
            put("updated_at", System.currentTimeMillis())
            put("brand", session.brand.wireName)
        }
        db.insertWithOnConflict(TABLE, null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    private fun loadSessionFromDb(): SibionicsSessionRecord? {
        val cursor = db.query(TABLE, null, "id = 1", null, null, null, null, "1")
        return cursor.use {
            if (!it.moveToFirst()) return null
            SibionicsSessionRecord(
                sensorId = it.getString(it.getColumnIndexOrThrow("sensor_id")),
                transmitterId = (it.getString(it.getColumnIndexOrThrow("transmitter_id")) as String?)
                    ?.takeIf { v -> v.isNotBlank() },
                status = runCatching {
                    SessionStatus.valueOf(it.getString(it.getColumnIndexOrThrow("status")))
                }.getOrDefault(SessionStatus.REGISTERED),
                connectedAtMs = it.getLong(it.getColumnIndexOrThrow("connected_at_ms"))
                    .takeIf { v -> v != 0L },
                brand = SensorBrand.fromWireName(
                    runCatching { it.getString(it.getColumnIndexOrThrow("brand")) }.getOrNull()
                )
            )
        }
    }

    // ── DB helper ─────────────────────────────────────────────────────────────

    companion object {
        private const val TABLE = "sensor_session"
        private const val DB_NAME = "glucore_session.db"
        private const val DB_VERSION = 2
    }

    private class SessionDbHelper(context: Context) :
        SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS sensor_session (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    sensor_id TEXT NOT NULL,
                    transmitter_id TEXT,
                    status TEXT NOT NULL,
                    connected_at_ms INTEGER,
                    updated_at INTEGER NOT NULL,
                    brand TEXT NOT NULL DEFAULT 'sibionics'
                )
            """.trimIndent())
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            // Session data must survive upgrades: dropping this table forces the
            // user to re-register the sensor. Never DROP + recreate here — add an
            // incremental migration step per schema version instead.
            if (oldVersion < 2) {
                db.execSQL("ALTER TABLE $TABLE ADD COLUMN brand TEXT NOT NULL DEFAULT 'sibionics'")
            }
        }
    }
}

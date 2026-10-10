package com.berdegeus.glucore

/**
 * Safety net for the BLE reconnect chain, independent of its own state.
 *
 * The chain (scan → connect → backoff timer → scan …) lives on the main
 * handler, so a single swallowed failure or a frozen timer leaves the sensor
 * disconnected with nothing left to retry. An OS alarm asks this class, once a
 * minute, whether the manager looks stuck; if so the owner restarts the
 * connection from scratch. Juggluco does the same with its loss-of-sensor
 * alarm (`LossOfSensorAlarm` → `SensorBluetooth.reconnectall`).
 *
 * Pure on purpose: the BLE stack can't run on the JVM, but the decision of
 * *when the chain counts as stuck* can.
 */
object ConnectionWatchdog {

    /** Where the manager's connection lifecycle currently is. */
    enum class Phase {
        /** GATT up and set up: notifications are expected. */
        CONNECTED,

        /** A scan, connect, auto-connect or backoff timer is pending. */
        ATTEMPTING,

        /** No GATT, no scan, no pending timer: nothing will ever retry. */
        IDLE
    }

    enum class Action { NONE, KICK }

    /**
     * @property idleGraceMs how long [Phase.IDLE] may last. Short: an idle
     *   manager with an active session is a dead chain by definition, the
     *   grace only covers the instant between one step ending and the next
     *   being scheduled.
     * @property attemptMaxAgeMs longest an attempt may go without any progress.
     *   Must exceed the largest backoff step (5 min) plus a scan window, so a
     *   healthy long backoff is never cut short.
     * @property connectedNoValueMs how long a set-up link may stay silent.
     *   Sibionics pushes a reading every minute.
     */
    data class Config(
        val idleGraceMs: Long = 60_000L,
        val attemptMaxAgeMs: Long = 6 * 60_000L,
        val connectedNoValueMs: Long = 5 * 60_000L
    )

    /**
     * @param sessionActive monitoring is on and the user has not stopped it.
     * @param adapterEnabled Bluetooth is on; with it off there is nothing to retry.
     * @param sinceProgressMs elapsed-realtime ms since the last lifecycle step
     *   (connect, disconnect, scan start, reconnect scheduled, reading).
     * @param sinceValueMs elapsed-realtime ms since the last reading, or since
     *   the link came up if none arrived yet.
     */
    fun evaluate(
        sessionActive: Boolean,
        adapterEnabled: Boolean,
        phase: Phase,
        sinceProgressMs: Long,
        sinceValueMs: Long,
        config: Config = Config()
    ): Action {
        if (!sessionActive || !adapterEnabled) return Action.NONE
        return when (phase) {
            Phase.CONNECTED ->
                if (sinceValueMs >= config.connectedNoValueMs) Action.KICK else Action.NONE
            Phase.ATTEMPTING ->
                if (sinceProgressMs >= config.attemptMaxAgeMs) Action.KICK else Action.NONE
            Phase.IDLE ->
                if (sinceProgressMs >= config.idleGraceMs) Action.KICK else Action.NONE
        }
    }
}

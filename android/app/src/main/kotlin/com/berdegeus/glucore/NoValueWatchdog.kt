package com.berdegeus.glucore

/**
 * "The sensor stopped giving values" watchdog, mirroring Juggluco's `novalue`
 * flag: codes 2, 8 and 10 arm a deadline, any normal result clears it, and the
 * connection is only restarted if the deadline passes with no value in between.
 *
 * Pure bookkeeping — the owner schedules the timer and asks [fire] when it
 * goes off. A token ties each timer to the arming that created it, so a timer
 * left over from an earlier arming can never restart a healthy connection.
 */
class NoValueWatchdog {
    private var armed = false
    private var token = 0L

    val isArmed: Boolean get() = armed

    /**
     * Arms the watchdog and returns the token to schedule against, or null if
     * it was already armed and [force] is false (the first deadline stands).
     */
    fun arm(force: Boolean = false): Long? {
        if (armed && !force) return null
        armed = true
        token += 1
        return token
    }

    /** A value (or any non-failure result) arrived: forget the pending deadline. */
    fun clear() {
        armed = false
        token += 1
    }

    /** The timer for [firedToken] went off; true if the connection should restart. */
    fun fire(firedToken: Long): Boolean {
        if (!armed || firedToken != token) return false
        armed = false
        return true
    }
}

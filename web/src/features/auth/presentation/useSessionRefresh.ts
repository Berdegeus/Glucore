import { useEffect, useRef } from 'react';
import { needsRefresh, REFRESH_WINDOW_MS, type Session } from '../domain/session';
import { useAuth } from './authProvider';

/** The events that count as "the person used the page" (ACC-10). */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown'] as const;

/** Added to the window so the timer fires with less than 5 minutes left, not exactly 5:00. */
const WINDOW_MARGIN_MS = 1000;

/** After a failed renewal, wait this long before trying again on activity. */
const RETRY_GAP_MS = 30_000;

/**
 * The expiry of a session that renews, or null for one that never does: the
 * patient's token lasts 30 days, and an unknown expiry gives nothing to schedule.
 * It asks the domain rule rather than repeating its role list.
 */
function renewableExpiry(session: Session): number | null {
  const { expiresAt } = session;
  if (!expiresAt || !needsRefresh(session, new Date(expiresAt.getTime() - 1), true)) return null;
  return expiresAt.getTime();
}

/**
 * Keeps a professional's or administrator's session alive while the person
 * uses the page (ACC-10). It tracks pointer and keyboard activity and, when
 * the window of the last 5 minutes opens, renews if there was activity in the
 * 5 minutes before. An idle tab is left to expire; a click or key press after
 * the window has opened renews at once. The patient's session never schedules.
 */
export function useSessionRefresh(): void {
  const { state, renewSession } = useAuth();
  const expiry = state.status === 'authenticated' ? renewableExpiry(state.session) : null;
  const lastActivity = useRef(0);
  const lastAttempt = useRef(Number.NEGATIVE_INFINITY);
  const inFlight = useRef(false);

  // Opening the page, or signing in, is the first activity.
  useEffect(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    if (expiry === null) return;
    const windowOpensAt = expiry - REFRESH_WINDOW_MS + WINDOW_MARGIN_MS;

    function attempt() {
      const now = Date.now();
      const recent = now - lastActivity.current < REFRESH_WINDOW_MS;
      if (inFlight.current || !recent || now < windowOpensAt || now - lastAttempt.current < RETRY_GAP_MS) return;
      inFlight.current = true;
      lastAttempt.current = now;
      // A refused token ends the session through the HTTP client; any other
      // failure leaves the session as it is for the next try.
      renewSession(true)
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
        });
    }

    function onActivity() {
      lastActivity.current = Date.now();
      attempt();
    }

    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, { passive: true });
    const timer = window.setTimeout(attempt, Math.max(windowOpensAt - Date.now(), 0));
    return () => {
      window.clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity);
    };
  }, [expiry, renewSession]);
}

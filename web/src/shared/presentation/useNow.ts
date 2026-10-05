import { useEffect, useState } from 'react';

const ONE_MINUTE_MS = 60_000;

/**
 * The current time, refreshed every minute, so a view that depends on "how
 * long ago" stays right without reading the clock while it renders.
 */
export function useNow(intervalMs: number = ONE_MINUTE_MS): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

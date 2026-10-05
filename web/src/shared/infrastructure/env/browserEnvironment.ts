import type { Clock, TimeZoneProvider } from '../../domain/ports';

/** What the API assumes when `tz` is omitted (API-01). */
const FALLBACK_TIME_ZONE = 'UTC';

/** The browser's IANA zone, sent as `tz` so days group in local time (API-01, RSP-09). */
export class BrowserTimeZoneProvider implements TimeZoneProvider {
  timeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

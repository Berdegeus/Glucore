/**
 * UTC calendar-day helpers for the admin statistics.
 *
 * Every admin chart is bucketed by UTC day, regardless of any viewer's time
 * zone, so the two services (identity and clinical) agree on where a day starts.
 * Buckets come back zero-filled: a day with no events is a 0 on the chart, not a
 * hole the client has to guess about.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayCount {
  /** `YYYY-MM-DD`, UTC. */
  day: string;
  count: number;
}

/** `YYYY-MM-DD` of the UTC calendar day the instant falls in. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 00:00 UTC of the day the instant falls in. */
export function utcDayStart(date: Date): Date {
  return new Date(`${utcDayKey(date)}T00:00:00.000Z`);
}

/** First instant of a period of `days` UTC calendar days that ends today, inclusive. */
export function utcPeriodStart(days: number, now: Date): Date {
  return new Date(utcDayStart(now).getTime() - (days - 1) * DAY_MS);
}

/** The `days` day keys of the period, oldest first, ending with today. */
export function utcPeriodDayKeys(days: number, now: Date): string[] {
  const start = utcPeriodStart(days, now).getTime();
  return Array.from({ length: days }, (_, i) => utcDayKey(new Date(start + i * DAY_MS)));
}

/**
 * Lays sparse `{ day, count }` rows over every day of the period. Rows outside
 * the period are dropped; a day missing from the rows is 0.
 */
export function fillDayCounts(dayKeys: readonly string[], rows: readonly DayCount[]): DayCount[] {
  const byDay = new Map(rows.map((row) => [row.day, row.count]));
  return dayKeys.map((day) => ({ day, count: byDay.get(day) ?? 0 }));
}

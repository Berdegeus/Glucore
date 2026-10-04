/** What a missing value shows instead of a number or a date (RSP-09). */
export const EMPTY_VALUE = '—';

const LOCALE = 'pt-BR';
const NBSP = '\u00a0';

type Maybe<T> = T | null | undefined;
export type Instant = Date | string;

const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, create: () => T): T {
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = create();
    formatters.set(key, formatter);
  }
  return formatter as T;
}

function isMissing(value: Maybe<number>): value is null | undefined {
  return value === null || value === undefined || !Number.isFinite(value);
}

/** `1234,5`: decimal comma, no thousands separator, so a table cell copies cleanly. */
export function formatNumber(value: Maybe<number>, fractionDigits = 1): string {
  if (isMissing(value)) return EMPTY_VALUE;
  const formatter = cached(
    `number|${fractionDigits}`,
    () =>
      new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
        useGrouping: false,
      }),
  );
  return formatter.format(value);
}

/** A value already in percent points: `70` becomes `70,0 %` (non-breaking space). */
export function formatPercent(value: Maybe<number>, fractionDigits = 1): string {
  if (isMissing(value)) return EMPTY_VALUE;
  return `${formatNumber(value, fractionDigits)}${NBSP}%`;
}

/** Glucose is shown in whole mg/dL: `142 mg/dL`. */
export function formatMgdl(value: Maybe<number>): string {
  if (isMissing(value)) return EMPTY_VALUE;
  return `${formatNumber(value, 0)}${NBSP}mg/dL`;
}

function toDate(instant: Maybe<Instant>): Date | null {
  if (instant === null || instant === undefined) return null;
  const date = instant instanceof Date ? instant : new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInstant(instant: Maybe<Instant>, timeZone: string, kind: 'date' | 'time'): string {
  const date = toDate(instant);
  if (!date) return EMPTY_VALUE;
  const options: Intl.DateTimeFormatOptions =
    kind === 'date'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  return cached(`${kind}|${timeZone}`, () => new Intl.DateTimeFormat(LOCALE, { ...options, timeZone })).format(date);
}

/** `05/08/2026`, on the calendar day of `timeZone`. */
export function formatDate(instant: Maybe<Instant>, timeZone: string): string {
  return formatInstant(instant, timeZone, 'date');
}

/** `14:30` (24 hours), on the clock of `timeZone`. */
export function formatTime(instant: Maybe<Instant>, timeZone: string): string {
  return formatInstant(instant, timeZone, 'time');
}

/** `05/08/2026 14:30`. */
export function formatDateTime(instant: Maybe<Instant>, timeZone: string): string {
  if (!toDate(instant)) return EMPTY_VALUE;
  return `${formatDate(instant, timeZone)} ${formatTime(instant, timeZone)}`;
}

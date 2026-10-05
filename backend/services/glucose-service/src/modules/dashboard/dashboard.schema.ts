import { BadRequestError } from '@glucore/shared';

/** Code carried by every dashboard range 400 — the app decides on it, never on the status alone. */
export const INVALID_DASHBOARD_RANGE = 'INVALID_DASHBOARD_RANGE';

/** Code for a `tz` that is malformed here, or that Postgres does not know (see `TimeZoneValidator`). */
export const INVALID_TIMEZONE = 'INVALID_TIMEZONE';

/** What `tz` falls back to when omitted — the behavior the endpoint had before `tz` existed. */
export const DEFAULT_TIMEZONE = 'UTC';

export interface DashboardQuery {
  /** Inclusive start of day, UTC. */
  from: Date;
  /** Inclusive end of day, UTC — callers building bounds must add a day for the exclusive upper edge. */
  to: Date;
  /** Only 'day' is implemented; 'hour' is a documented follow-up, not a silent default. */
  bucket: 'day';
  /** IANA zone name used to cut days and hours. Shape-checked here; existence is checked against Postgres. */
  tz: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// The longest IANA names ("America/Argentina/ComodRivadavia") are well under 64.
const MAX_TZ_LENGTH = 64;
// IANA names use letters, digits, `_`, `+`, `-` and `/` only ("Etc/GMT+3", "America/Port-au-Prince").
const TZ_RE = /^[A-Za-z0-9_+\-/]+$/;
const DEFAULT_SPAN_DAYS = 14;
const MAX_SPAN_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateParam(value: unknown, name: string): Date | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new BadRequestError(`${name} must be an ISO date (YYYY-MM-DD)`, INVALID_DASHBOARD_RANGE);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${name} must be a valid date`, INVALID_DASHBOARD_RANGE);
  }
  return date;
}

export function parseTzParam(value: unknown): string {
  if (value === undefined) return DEFAULT_TIMEZONE;
  if (typeof value !== 'string' || value.length > MAX_TZ_LENGTH || !TZ_RE.test(value)) {
    throw new BadRequestError('tz must be an IANA time zone name', INVALID_TIMEZONE);
  }
  return value;
}

function todayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Reads `from`/`to`/`bucket`/`tz` off the dashboard query string.
 *
 * Defaults to the last 14 days ending today; span is capped at 90 days so a
 * caller cannot force the daily-bucket and excursion queries to scan the
 * patient's entire history in one request.
 */
export function parseDashboardQuery(query: {
  from?: unknown;
  to?: unknown;
  bucket?: unknown;
  tz?: unknown;
}): DashboardQuery {
  const bucket = query.bucket === undefined ? 'day' : query.bucket;
  if (bucket !== 'day') {
    throw new BadRequestError(
      "bucket must be 'day' — it is the only bucket implemented today",
      INVALID_DASHBOARD_RANGE,
    );
  }

  const to = parseDateParam(query.to, 'to') ?? todayUtc();
  const from = parseDateParam(query.from, 'from') ?? new Date(to.getTime() - DEFAULT_SPAN_DAYS * MS_PER_DAY);

  if (from.getTime() > to.getTime()) {
    throw new BadRequestError('from must not be after to', INVALID_DASHBOARD_RANGE);
  }

  const spanDays = (to.getTime() - from.getTime()) / MS_PER_DAY;
  if (spanDays > MAX_SPAN_DAYS) {
    throw new BadRequestError(`range must not exceed ${MAX_SPAN_DAYS} days`, INVALID_DASHBOARD_RANGE);
  }

  return { from, to, bucket: 'day', tz: parseTzParam(query.tz) };
}

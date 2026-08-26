/**
 * Parsers for the optional profile fields.
 *
 * All three share one convention, and every caller depends on it:
 *
 *   undefined -> the value was absent, or unusable (the caller answers 400)
 *   null      -> the value was explicitly cleared
 *   a value   -> parsed
 *
 * Collapsing "absent" and "invalid" onto `undefined` is what lets a caller
 * write `if (body.field !== undefined && parsed === undefined) reject`, which
 * is how every profile field is validated today.
 */

/** Rebuilds a UTC date and rejects a rolled-over one, e.g. 31/02 or 2026-02-30. */
function utcDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return roundTrips ? date : undefined;
}

/**
 * Accepts `YYYY-MM-DD` and `DD/MM/YYYY`, then anything `Date` can parse.
 *
 * The Brazilian form is not decorative: it is what the app's date field emits.
 * Dropping it would make every profile save from the app fail validation, and
 * nothing in the type system would say so.
 *
 * Both explicit forms are built in UTC. A birth date is a calendar date, not an
 * instant, and parsing it in local time shifts it a day for anyone west of
 * Greenwich.
 */
export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  const text = String(value).trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (brazilian) {
    return utcDate(Number(brazilian[3]), Number(brazilian[2]), Number(brazilian[1]));
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Any finite number. Blank clears the field; the caller rejects `undefined`. */
export function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * Whole numbers only, and no null: a target range has no "cleared" state, so a
 * blank simply leaves the stored value alone.
 */
export function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

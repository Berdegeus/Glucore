import { AppError } from '../../../shared/domain/appError';

/** The quick choices of the period filter, in days (PAC-02). */
export const PERIOD_PRESETS = [7, 14, 30, 90] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** What the dashboard opens on (PAC-01). */
export const DEFAULT_PRESET: PeriodPreset = 14;

/** A period never covers more days than this, counting both ends (PAC-03, PAC-04). */
export const MAX_PERIOD_DAYS = 90;

/** The text shown when a custom period is refused (PAC-04). */
export const PERIOD_ERROR_MESSAGE = 'Escolha um período de até 90 dias';

/** Machine-readable code of the `validation` error a refused period turns into. */
export const INVALID_PERIOD_CODE = 'INVALID_PERIOD';

/** A period of whole calendar days, both ends included, as `YYYY-MM-DD`. */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export type PeriodValidation =
  | { ok: true; range: DateRange }
  | { ok: false; message: string; error: AppError };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC of a `YYYY-MM-DD` day, or `null` when the text is not a real calendar day. */
function parseDay(day: string): number | null {
  if (!ISO_DAY.test(day)) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) return null;
  return ms;
}

const formatDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The last `preset` days ending on `today`, today included: 7 days is `today - 6` to `today`. */
export function toRange(preset: PeriodPreset, today: string): DateRange {
  const end = parseDay(today);
  if (end === null) throw new RangeError('today must be a YYYY-MM-DD day');
  return { from: formatDay(end - (preset - 1) * MS_PER_DAY), to: today };
}

/**
 * A custom period is valid when both ends are real days, the start is not after
 * the end and it spans at most 90 days (PAC-04). Counting both ends keeps it
 * inside what the API accepts (a difference of at most 90 days).
 */
export function validateCustom(from: string, to: string): PeriodValidation {
  const start = parseDay(from);
  const end = parseDay(to);
  const days = start === null || end === null ? Infinity : (end - start) / MS_PER_DAY + 1;
  if (days < 1 || days > MAX_PERIOD_DAYS) {
    return {
      ok: false,
      message: PERIOD_ERROR_MESSAGE,
      error: new AppError('validation', { code: INVALID_PERIOD_CODE }),
    };
  }
  return { ok: true, range: { from, to } };
}

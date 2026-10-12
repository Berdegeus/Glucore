import { BadRequestError } from '@glucore/shared';

/**
 * The shape of contracts/glucose-histogram.json, which the app and the tests
 * read from the file itself. A change to the bin range is a contract change:
 * it moves every stored histogram.
 */
export const HISTOGRAM_MIN_MGDL = 40;
export const HISTOGRAM_MAX_MGDL = 600;
export const HISTOGRAM_BINS = HISTOGRAM_MAX_MGDL - HISTOGRAM_MIN_MGDL + 1;
export const MAX_SLOTS_PER_DAY = 300;
export const MAX_SUMMARY_DAYS = 14;

/** One patient-local day, as the app sends it. */
export interface DailySummaryInput {
  /** `YYYY-MM-DD` in the offset below. */
  localDate: string;
  /** Minutes east of UTC when the app cut the day. */
  utcOffsetMinutes: number;
  readingsCount: number;
  /** 5-minute slots of the day with at least one reading. */
  coveredSlots: number;
  /** Readings per whole mg/dL, index 0 = 40 mg/dL. */
  histogram: number[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(index: number, message: string): never {
  throw new BadRequestError(`days[${index}]: ${message}`);
}

function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validates a batch of daily summaries. The table's CHECKs say the same things,
 * but a CHECK failure is a 500; here it is a 400 that names the day and the
 * field. A batch is applied whole or rejected whole, like the readings batch.
 */
export function parseSummaryBatch(body: unknown): DailySummaryInput[] {
  const { days } = (body ?? {}) as { days?: unknown };
  if (!Array.isArray(days)) throw new BadRequestError('days must be array');
  if (days.length > MAX_SUMMARY_DAYS) {
    throw new BadRequestError(`days batch exceeds ${MAX_SUMMARY_DAYS} entries`);
  }

  const seen = new Set<string>();
  return days.map((raw, index) => {
    const day = (raw ?? {}) as Record<string, unknown>;

    if (typeof day.localDate !== 'string' || !isCalendarDate(day.localDate)) {
      fail(index, 'localDate must be a YYYY-MM-DD calendar date');
    }
    if (seen.has(day.localDate)) fail(index, `localDate ${day.localDate} appears twice`);
    seen.add(day.localDate);

    if (!isInt(day.utcOffsetMinutes, -840, 840)) {
      fail(index, 'utcOffsetMinutes must be an integer between -840 and 840');
    }
    if (!isInt(day.readingsCount, 1, Number.MAX_SAFE_INTEGER)) {
      fail(index, 'readingsCount must be a positive integer');
    }
    if (!isInt(day.coveredSlots, 0, MAX_SLOTS_PER_DAY) || day.coveredSlots > day.readingsCount) {
      fail(index, `coveredSlots must be an integer between 0 and ${MAX_SLOTS_PER_DAY}, and at most readingsCount`);
    }

    const histogram = day.histogram;
    if (!Array.isArray(histogram) || histogram.length !== HISTOGRAM_BINS) {
      fail(index, `histogram must be an array of ${HISTOGRAM_BINS} counts`);
    }
    let total = 0;
    for (const count of histogram) {
      if (!isInt(count, 0, Number.MAX_SAFE_INTEGER)) {
        fail(index, 'histogram counts must be non-negative integers');
      }
      total += count;
    }
    if (total !== day.readingsCount) fail(index, 'histogram must add up to readingsCount');

    return {
      localDate: day.localDate,
      utcOffsetMinutes: day.utcOffsetMinutes,
      readingsCount: day.readingsCount,
      coveredSlots: day.coveredSlots,
      histogram,
    };
  });
}

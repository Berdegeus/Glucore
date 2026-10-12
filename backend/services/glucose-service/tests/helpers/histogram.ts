import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { DailySummaryInput } from '../../src/modules/readings/summaries.schema';

/** `contracts/glucose-histogram.json`, the file the app and the backend share. */
export const HISTOGRAM_CONTRACT = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../../contracts/glucose-histogram.json'), 'utf8'),
) as {
  minMgDl: number;
  maxMgDl: number;
  bins: number;
  slotMinutes: number;
  maxSlotsPerDay: number;
  maxDaysPerRequest: number;
};

/** A histogram with `counts[mgDl]` readings at each listed value. */
export function histogramOf(counts: Record<number, number>): number[] {
  const histogram = new Array<number>(HISTOGRAM_CONTRACT.bins).fill(0);
  for (const [mgDl, count] of Object.entries(counts)) {
    histogram[Number(mgDl) - HISTOGRAM_CONTRACT.minMgDl] = count;
  }
  return histogram;
}

/** A valid summary of one day; override what the test cares about. */
export function summaryOf(
  localDate: string,
  counts: Record<number, number> = { 100: 200, 150: 100 },
  overrides: Partial<DailySummaryInput> = {},
): DailySummaryInput {
  const readingsCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return {
    localDate,
    utcOffsetMinutes: -180,
    readingsCount,
    coveredSlots: Math.min(288, readingsCount),
    histogram: histogramOf(counts),
    ...overrides,
  };
}

export interface SeedReading {
  /** Epoch ms. */
  at: number;
  mgDl: number;
}

/**
 * The summaries the app would upload for these readings, cut in a fixed offset
 * (minutes east of UTC; Brasilia has had no daylight saving since 2019). This is
 * the app's rule written down once more, so the backend tests can build the
 * summary of a series and check the dashboard reads the two alike.
 */
export function summariesFromReadings(
  readings: readonly SeedReading[],
  utcOffsetMinutes: number,
): DailySummaryInput[] {
  const days = new Map<string, SeedReading[]>();
  for (const reading of readings) {
    const local = new Date(reading.at + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
    days.set(local, [...(days.get(local) ?? []), reading]);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([localDate, rows]) => {
      const histogram = new Array<number>(HISTOGRAM_CONTRACT.bins).fill(0);
      for (const { mgDl } of rows) {
        const clamped = Math.min(HISTOGRAM_CONTRACT.maxMgDl, Math.max(HISTOGRAM_CONTRACT.minMgDl, mgDl));
        histogram[clamped - HISTOGRAM_CONTRACT.minMgDl] += 1;
      }
      const slotMs = HISTOGRAM_CONTRACT.slotMinutes * 60_000;
      return {
        localDate,
        utcOffsetMinutes,
        readingsCount: rows.length,
        coveredSlots: new Set(rows.map((r) => Math.floor(r.at / slotMs))).size,
        histogram,
      };
    });
}

/** Deterministic values between 45 and 320 mg/dL: low and high enough to fill every zone. */
export function seededValues(count: number, seed = 7): number[] {
  let state = seed;
  return Array.from({ length: count }, () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return 45 + (state % 276);
  });
}

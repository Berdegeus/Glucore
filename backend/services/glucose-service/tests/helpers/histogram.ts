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

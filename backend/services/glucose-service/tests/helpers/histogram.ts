import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { GlucoseBucketInput } from '../../src/modules/readings/buckets.schema';

/** `contracts/glucose-histogram.json`, the file the app and the backend share. */
export const HISTOGRAM_CONTRACT = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../../contracts/glucose-histogram.json'), 'utf8'),
) as {
  minMgDl: number;
  maxMgDl: number;
  bucketMinutes: number;
  slotMinutes: number;
  slotsPerBucket: number;
  maxBucketsPerRequest: number;
};

export const BUCKET_MS = HISTOGRAM_CONTRACT.bucketMinutes * 60_000;
const SLOT_MS = HISTOGRAM_CONTRACT.slotMinutes * 60_000;

/** The start of the 15-minute interval that holds `ms`. */
export const bucketStartOf = (ms: number): number => ms - (ms % BUCKET_MS);

/**
 * A valid bucket at `startMs`: `counts[mgDl]` readings at each listed value.
 * `startMs` is moved down to the interval it falls in.
 */
export function bucketOf(
  startMs: number,
  counts: Record<number, number> = { 100: 10, 150: 5 },
  overrides: Partial<GlucoseBucketInput> = {},
): GlucoseBucketInput {
  const mgDl = Object.keys(counts)
    .map(Number)
    .sort((a, b) => a - b);
  const readingsCount = mgDl.reduce((sum, value) => sum + counts[value], 0);
  return {
    startMs: bucketStartOf(startMs),
    readingsCount,
    coveredSlots: Math.min(HISTOGRAM_CONTRACT.slotsPerBucket, readingsCount),
    mgDl,
    counts: mgDl.map((value) => counts[value]),
    ...overrides,
  };
}

export interface SeedReading {
  /** Epoch ms. */
  at: number;
  mgDl: number;
}

/**
 * The buckets the app would upload for these readings: grouped by 15-minute
 * interval aligned to UTC, values clamped to the contract's range, slots counted
 * from the series. This is the app's rule written down once more, so the backend
 * tests can build the buckets of a series and check the dashboard reads the two
 * alike.
 */
export function bucketsFromReadings(readings: readonly SeedReading[]): GlucoseBucketInput[] {
  const byBucket = new Map<number, SeedReading[]>();
  for (const reading of readings) {
    const key = bucketStartOf(reading.at);
    byBucket.set(key, [...(byBucket.get(key) ?? []), reading]);
  }

  return [...byBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startMs, rows]) => {
      const counts = new Map<number, number>();
      for (const { mgDl } of rows) {
        const clamped = Math.min(HISTOGRAM_CONTRACT.maxMgDl, Math.max(HISTOGRAM_CONTRACT.minMgDl, mgDl));
        counts.set(clamped, (counts.get(clamped) ?? 0) + 1);
      }
      const mgDl = [...counts.keys()].sort((a, b) => a - b);
      return {
        startMs,
        readingsCount: rows.length,
        coveredSlots: new Set(rows.map((r) => Math.floor(r.at / SLOT_MS))).size,
        mgDl,
        counts: mgDl.map((value) => counts.get(value)!),
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

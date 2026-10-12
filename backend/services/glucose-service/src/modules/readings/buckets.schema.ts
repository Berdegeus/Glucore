import { BadRequestError } from '@glucore/shared';

/**
 * The shape of contracts/glucose-histogram.json, which the app and the tests
 * read from the file itself. A change here is a contract change: it moves every
 * stored bucket.
 */
export const BUCKET_MIN_MGDL = 40;
export const BUCKET_MAX_MGDL = 600;
export const BUCKET_MS = 15 * 60_000;
export const SLOTS_PER_BUCKET = 3;
export const MAX_BUCKET_BATCH = 288;

/** One 15-minute interval as the app sends it. */
export interface GlucoseBucketInput {
  /** Epoch ms of the interval's start; a multiple of 15 minutes. */
  startMs: number;
  readingsCount: number;
  /** 5-minute slots of the interval with at least one reading (1 to 3). */
  coveredSlots: number;
  /** Distinct values in mg/dL, ascending, within 40..600. */
  mgDl: number[];
  /** Readings at each value, in the same order. */
  counts: number[];
}

function fail(index: number, message: string): never {
  throw new BadRequestError(`buckets[${index}]: ${message}`);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validates a batch of buckets. The table's CHECKs say the same things, but a
 * CHECK failure is a 500; here it is a 400 that names the bucket and the field.
 * A batch is applied whole or rejected whole, like the readings batch.
 */
export function parseBucketBatch(body: unknown): GlucoseBucketInput[] {
  const { buckets } = (body ?? {}) as { buckets?: unknown };
  if (!Array.isArray(buckets)) throw new BadRequestError('buckets must be array');
  if (buckets.length > MAX_BUCKET_BATCH) {
    throw new BadRequestError(`buckets batch exceeds ${MAX_BUCKET_BATCH} entries`);
  }

  const seen = new Set<number>();
  return buckets.map((raw, index) => {
    const bucket = (raw ?? {}) as Record<string, unknown>;

    if (!isInt(bucket.startMs, 0, Number.MAX_SAFE_INTEGER) || bucket.startMs % BUCKET_MS !== 0) {
      fail(index, 'startMs must be an epoch in milliseconds, a multiple of 15 minutes');
    }
    if (seen.has(bucket.startMs)) fail(index, `startMs ${bucket.startMs} appears twice`);
    seen.add(bucket.startMs);

    if (!isInt(bucket.readingsCount, 1, Number.MAX_SAFE_INTEGER)) {
      fail(index, 'readingsCount must be a positive integer');
    }
    if (!isInt(bucket.coveredSlots, 1, SLOTS_PER_BUCKET) || bucket.coveredSlots > bucket.readingsCount) {
      fail(index, `coveredSlots must be an integer between 1 and ${SLOTS_PER_BUCKET}, and at most readingsCount`);
    }

    const { mgDl, counts } = bucket;
    const maxDistinct = BUCKET_MAX_MGDL - BUCKET_MIN_MGDL + 1;
    if (!Array.isArray(mgDl) || mgDl.length < 1 || mgDl.length > maxDistinct) {
      fail(index, `mgDl must be an array of 1 to ${maxDistinct} values`);
    }
    if (!Array.isArray(counts) || counts.length !== mgDl.length) {
      fail(index, 'counts must be an array as long as mgDl');
    }

    let total = 0;
    let previous = BUCKET_MIN_MGDL - 1;
    for (let i = 0; i < mgDl.length; i += 1) {
      const value = mgDl[i];
      if (!isInt(value, BUCKET_MIN_MGDL, BUCKET_MAX_MGDL)) {
        fail(index, `mgDl values must be integers between ${BUCKET_MIN_MGDL} and ${BUCKET_MAX_MGDL}`);
      }
      if (value <= previous) fail(index, 'mgDl values must be strictly ascending');
      previous = value;

      const count = counts[i];
      if (!isInt(count, 1, Number.MAX_SAFE_INTEGER)) fail(index, 'counts must be positive integers');
      total += count;
    }
    if (total !== bucket.readingsCount) fail(index, 'counts must add up to readingsCount');

    return {
      startMs: bucket.startMs,
      readingsCount: bucket.readingsCount,
      coveredSlots: bucket.coveredSlots,
      mgDl,
      counts,
    };
  });
}

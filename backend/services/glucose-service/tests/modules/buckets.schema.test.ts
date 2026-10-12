import { describe, expect, it } from 'vitest';
import { BadRequestError } from '@glucore/shared';

import {
  BUCKET_MAX_MGDL,
  BUCKET_MIN_MGDL,
  BUCKET_MS,
  MAX_BUCKET_BATCH,
  SLOTS_PER_BUCKET,
  parseBucketBatch,
} from '../../src/modules/readings/buckets.schema';
import { HISTOGRAM_CONTRACT, bucketOf } from '../helpers/histogram';

const T0 = Date.UTC(2026, 7, 5, 12);

describe('the bucket contract', () => {
  it('is the one contracts/glucose-histogram.json declares', () => {
    expect(BUCKET_MIN_MGDL).toBe(HISTOGRAM_CONTRACT.minMgDl);
    expect(BUCKET_MAX_MGDL).toBe(HISTOGRAM_CONTRACT.maxMgDl);
    expect(BUCKET_MS).toBe(HISTOGRAM_CONTRACT.bucketMinutes * 60_000);
    expect(SLOTS_PER_BUCKET).toBe(HISTOGRAM_CONTRACT.slotsPerBucket);
    expect(MAX_BUCKET_BATCH).toBe(HISTOGRAM_CONTRACT.maxBucketsPerRequest);
    expect(HISTOGRAM_CONTRACT.bucketMinutes / HISTOGRAM_CONTRACT.slotMinutes).toBe(SLOTS_PER_BUCKET);
  });
});

describe('parseBucketBatch', () => {
  it('accepts a valid bucket and an empty batch', () => {
    const bucket = bucketOf(T0);
    expect(parseBucketBatch({ buckets: [bucket] })).toEqual([bucket]);
    expect(parseBucketBatch({ buckets: [] })).toEqual([]);
  });

  it('accepts a batch of exactly the maximum size', () => {
    const buckets = Array.from({ length: MAX_BUCKET_BATCH }, (_, i) => bucketOf(T0 + i * BUCKET_MS));
    expect(parseBucketBatch({ buckets })).toHaveLength(MAX_BUCKET_BATCH);
  });

  it('rejects a batch over the maximum instead of truncating it', () => {
    const buckets = Array.from({ length: MAX_BUCKET_BATCH + 1 }, (_, i) => bucketOf(T0 + i * BUCKET_MS));
    expect(() => parseBucketBatch({ buckets })).toThrow(`buckets batch exceeds ${MAX_BUCKET_BATCH} entries`);
  });

  it.each([[{}], [undefined], [{ buckets: 'nope' }], [{ buckets: null }]])('rejects %j', (body) => {
    expect(() => parseBucketBatch(body)).toThrow('buckets must be array');
  });

  it('accepts the extremes of the range and a single value', () => {
    const bucket = bucketOf(T0, { 40: 1, 600: 1 });
    expect(parseBucketBatch({ buckets: [bucket] })).toEqual([bucket]);
  });

  it.each([
    ['a start that is not on a 15-minute boundary', { startMs: T0 + 1 }],
    ['a start 5 minutes in', { startMs: T0 + 5 * 60_000 }],
    ['a negative start', { startMs: -BUCKET_MS }],
    ['a fractional start', { startMs: T0 + 0.5 }],
    ['a missing start', { startMs: undefined }],
    ['a zero count', { readingsCount: 0 }],
    ['a count the values do not add up to', { readingsCount: 16 }],
    ['no covered slots', { coveredSlots: 0 }],
    ['more slots than a bucket has', { coveredSlots: SLOTS_PER_BUCKET + 1 }],
    ['an empty list of values', { mgDl: [], counts: [] }],
    ['counts shorter than values', { counts: [10] }],
    ['a value below the range', { mgDl: [39, 150] }],
    ['a value above the range', { mgDl: [100, 601] }],
    ['a fractional value', { mgDl: [100.5, 150] }],
    ['values out of order', { mgDl: [150, 100] }],
    ['a repeated value', { mgDl: [100, 100] }],
    ['a zero count in the list', { counts: [15, 0] }],
    ['a negative count', { counts: [20, -5] }],
    ['a fractional count', { counts: [10.5, 4.5] }],
  ])('rejects %s', (_label, override) => {
    const bucket = { ...bucketOf(T0), ...override };
    expect(() => parseBucketBatch({ buckets: [bucket] })).toThrow(BadRequestError);
  });

  it('rejects more slots than readings', () => {
    const bucket = bucketOf(T0, { 100: 1 }, { coveredSlots: 2 });
    expect(() => parseBucketBatch({ buckets: [bucket] })).toThrow(BadRequestError);
  });

  it('names the bucket that is wrong', () => {
    const buckets = [bucketOf(T0), { ...bucketOf(T0 + BUCKET_MS), readingsCount: 5 }];
    expect(() => parseBucketBatch({ buckets })).toThrow(/^buckets\[1\]: /);
  });

  it('rejects the same interval twice in one batch', () => {
    expect(() => parseBucketBatch({ buckets: [bucketOf(T0), bucketOf(T0)] })).toThrow('appears twice');
  });
});

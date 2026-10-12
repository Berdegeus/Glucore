import { describe, expect, it } from 'vitest';
import { BadRequestError } from '@glucore/shared';

import {
  HISTOGRAM_BINS,
  HISTOGRAM_MAX_MGDL,
  HISTOGRAM_MIN_MGDL,
  MAX_SLOTS_PER_DAY,
  MAX_SUMMARY_DAYS,
  parseSummaryBatch,
} from '../../src/modules/readings/summaries.schema';
import { HISTOGRAM_CONTRACT, histogramOf, summaryOf } from '../helpers/histogram';

describe('the histogram contract', () => {
  it('is the one contracts/glucose-histogram.json declares', () => {
    expect(HISTOGRAM_MIN_MGDL).toBe(HISTOGRAM_CONTRACT.minMgDl);
    expect(HISTOGRAM_MAX_MGDL).toBe(HISTOGRAM_CONTRACT.maxMgDl);
    expect(HISTOGRAM_BINS).toBe(HISTOGRAM_CONTRACT.bins);
    expect(MAX_SLOTS_PER_DAY).toBe(HISTOGRAM_CONTRACT.maxSlotsPerDay);
    expect(MAX_SUMMARY_DAYS).toBe(HISTOGRAM_CONTRACT.maxDaysPerRequest);
  });
});

describe('parseSummaryBatch', () => {
  it('accepts a valid day and an empty batch', () => {
    const day = summaryOf('2026-10-10');
    expect(parseSummaryBatch({ days: [day] })).toEqual([day]);
    expect(parseSummaryBatch({ days: [] })).toEqual([]);
  });

  it('accepts a batch of exactly the maximum size', () => {
    const days = Array.from({ length: MAX_SUMMARY_DAYS }, (_, i) =>
      summaryOf(`2026-10-${String(i + 1).padStart(2, '0')}`),
    );
    expect(parseSummaryBatch({ days })).toHaveLength(MAX_SUMMARY_DAYS);
  });

  it('rejects a batch over the maximum instead of truncating it', () => {
    const days = Array.from({ length: MAX_SUMMARY_DAYS + 1 }, (_, i) =>
      summaryOf(`2026-10-${String(i + 1).padStart(2, '0')}`),
    );
    expect(() => parseSummaryBatch({ days })).toThrow(`days batch exceeds ${MAX_SUMMARY_DAYS} entries`);
  });

  it.each([[{}], [undefined], [{ days: 'nope' }], [{ days: null }]])('rejects %j', (body) => {
    expect(() => parseSummaryBatch(body)).toThrow('days must be array');
  });

  it.each([
    ['a date that does not exist', { localDate: '2026-02-30' }],
    ['a date in another format', { localDate: '10/10/2026' }],
    ['a missing date', { localDate: undefined }],
    ['an offset beyond 14 hours', { utcOffsetMinutes: 841 }],
    ['a fractional offset', { utcOffsetMinutes: -180.5 }],
    ['a zero count', { readingsCount: 0 }],
    ['a count the histogram does not add up to', { readingsCount: 301 }],
    ['more slots than a day has', { coveredSlots: MAX_SLOTS_PER_DAY + 1 }],
    ['more slots than readings', { coveredSlots: 301 }],
    ['a short histogram', { histogram: new Array(HISTOGRAM_BINS - 1).fill(0) }],
    ['a long histogram', { histogram: new Array(HISTOGRAM_BINS + 1).fill(0) }],
    ['a negative bin', { histogram: histogramOf({ 100: 301, 120: -1 }) }],
    ['a fractional bin', { histogram: histogramOf({ 100: 300.5 }) }],
  ])('rejects %s', (_label, override) => {
    const day = { ...summaryOf('2026-10-10'), ...override };
    expect(() => parseSummaryBatch({ days: [day] })).toThrow(BadRequestError);
  });

  it('names the day that is wrong', () => {
    const days = [summaryOf('2026-10-09'), { ...summaryOf('2026-10-10'), readingsCount: 5 }];
    expect(() => parseSummaryBatch({ days })).toThrow(/^days\[1\]: /);
  });

  it('rejects the same day twice in one batch', () => {
    const days = [summaryOf('2026-10-10'), summaryOf('2026-10-10')];
    expect(() => parseSummaryBatch({ days })).toThrow('appears twice');
  });
});

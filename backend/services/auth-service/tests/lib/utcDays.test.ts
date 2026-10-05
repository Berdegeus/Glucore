import { describe, expect, it } from 'vitest';

import {
  fillDayCounts,
  utcDayKey,
  utcDayStart,
  utcPeriodDayKeys,
  utcPeriodStart,
  utcPeriodWeekKeys,
  utcWeekStart,
} from '@glucore/shared';

/** The UTC day arithmetic both services' admin statistics build on (ADM-02). */

describe('utc day helpers', () => {
  it('keys an instant by its UTC day, not the local one', () => {
    expect(utcDayKey(new Date('2026-03-11T23:59:59.999Z'))).toBe('2026-03-11');
    expect(utcDayKey(new Date('2026-03-12T00:00:00.000Z'))).toBe('2026-03-12');
    expect(utcDayStart(new Date('2026-03-11T15:30:00.000Z')).toISOString()).toBe(
      '2026-03-11T00:00:00.000Z',
    );
  });

  it('starts a period of N days N-1 days before today, at UTC midnight', () => {
    const now = new Date('2026-03-11T10:00:00.000Z');
    expect(utcPeriodStart(1, now).toISOString()).toBe('2026-03-11T00:00:00.000Z');
    expect(utcPeriodStart(7, now).toISOString()).toBe('2026-03-05T00:00:00.000Z');
  });

  it('lists the period days oldest first across a month boundary', () => {
    expect(utcPeriodDayKeys(4, new Date('2026-03-02T01:00:00.000Z'))).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
  });

  it('starts a week on the Monday, UTC', () => {
    // 2026-03-11 is a Wednesday; 2026-03-15 a Sunday; 2026-03-16 the next Monday.
    expect(utcWeekStart(new Date('2026-03-11T10:00:00.000Z')).toISOString()).toBe('2026-03-09T00:00:00.000Z');
    expect(utcWeekStart(new Date('2026-03-15T23:59:59.999Z')).toISOString()).toBe('2026-03-09T00:00:00.000Z');
    expect(utcWeekStart(new Date('2026-03-16T00:00:00.000Z')).toISOString()).toBe('2026-03-16T00:00:00.000Z');
  });

  it('lists the Mondays of every week that overlaps the period', () => {
    // 7 days ending Wed 03-11 starts Thu 03-05: weeks of 03-02 and 03-09.
    expect(utcPeriodWeekKeys(7, new Date('2026-03-11T10:00:00.000Z'))).toEqual(['2026-03-02', '2026-03-09']);
    // 7 days ending on a Sunday is exactly one week.
    expect(utcPeriodWeekKeys(7, new Date('2026-03-15T10:00:00.000Z'))).toEqual(['2026-03-09']);
    // 7 days ending on a Monday reaches back into the previous week.
    expect(utcPeriodWeekKeys(7, new Date('2026-03-16T10:00:00.000Z'))).toEqual(['2026-03-09', '2026-03-16']);
    expect(utcPeriodWeekKeys(1, new Date('2026-03-16T10:00:00.000Z'))).toEqual(['2026-03-16']);
  });

  it('zero-fills missing days and drops rows outside the period', () => {
    const keys = ['2026-03-10', '2026-03-11'];
    expect(
      fillDayCounts(keys, [
        { day: '2026-03-11', count: 3 },
        { day: '2026-03-01', count: 9 },
      ]),
    ).toEqual([
      { day: '2026-03-10', count: 0 },
      { day: '2026-03-11', count: 3 },
    ]);
  });
});

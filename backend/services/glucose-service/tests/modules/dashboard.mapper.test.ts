import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  mapAgpRow,
  mapAlertsByTypeRow,
  mapDailyBucketRow,
  mapExcursionRow,
  mapHeatCellRow,
  mapInsulinByTypeRow,
  mapPeriodMetricsRow,
  mapZonesRow,
  toNullableNumber,
  toNumber,
} from '../../src/modules/dashboard/dashboard.mapper';

/**
 * The three raw shapes `$queryRaw`/`groupBy` actually hand back — a `bigint`
 * from `COUNT(*)`, a `Prisma.Decimal` from a raw `numeric`/`DECIMAL` column,
 * and a plain string (some drivers stringify `numeric` instead). All three
 * throw on `JSON.stringify` un-touched; this file is what proves they don't
 * once the mapper is done with them.
 */
describe('toNumber / toNullableNumber — the coercion boundary', () => {
  it('converts a bigint (COUNT(*))', () => {
    expect(toNumber(42n)).toBe(42);
  });

  it('converts a Prisma.Decimal (a raw NUMERIC column)', () => {
    expect(toNumber(new Prisma.Decimal('123.45'))).toBeCloseTo(123.45);
  });

  it('converts a numeric string', () => {
    expect(toNumber('67.8')).toBeCloseTo(67.8);
  });

  it('treats null/undefined as 0 for toNumber, null for toNullableNumber', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
  });

  it('every mapped field survives JSON.stringify — the point of this whole module', () => {
    const row = mapPeriodMetricsRow({
      avg_glucose: new Prisma.Decimal('142.30'),
      gmi: new Prisma.Decimal('6.65'),
      cv: new Prisma.Decimal('28.10'),
      tir_percent: '71.50',
      readings_count: 288n,
    });
    expect(() => JSON.stringify(row)).not.toThrow();
    expect(row).toEqual({ avgGlucose: 142.3, gmiPercent: 6.65, cvPercent: 28.1, timeInRangePercent: 71.5, readingsCount: 288 });
  });
});

describe('mapPeriodMetricsRow', () => {
  it('answers all-null/zero when the stored procedure returns no row (no readings in range)', () => {
    expect(mapPeriodMetricsRow(undefined)).toEqual({
      avgGlucose: null,
      gmiPercent: null,
      cvPercent: null,
      timeInRangePercent: null,
      readingsCount: 0,
    });
  });
});

describe('mapDailyBucketRow', () => {
  it('formats the date_trunc day as YYYY-MM-DD and coerces the rest', () => {
    const dto = mapDailyBucketRow({
      day: new Date('2026-08-05T00:00:00.000Z'),
      avg_glucose: new Prisma.Decimal('130.5'),
      min_glucose: 68,
      max_glucose: 210,
      readings_count: 288n,
      time_in_range_percent: new Prisma.Decimal('75.00'),
      moving_avg_7d: null,
    });
    expect(dto).toEqual({
      day: '2026-08-05',
      avgGlucose: 130.5,
      minGlucose: 68,
      maxGlucose: 210,
      readingsCount: 288,
      timeInRangePercent: 75,
      movingAvg7d: null,
    });
  });
});

describe('mapExcursionRow', () => {
  it('coerces the gaps-and-islands duration and bounds', () => {
    const dto = mapExcursionRow({
      kind: 'HYPER',
      started_at: new Date('2026-08-05T22:00:00.000Z'),
      ended_at: new Date('2026-08-05T22:25:00.000Z'),
      duration_min: new Prisma.Decimal('25'),
      min_glucose: 185,
      max_glucose: 240,
    });
    expect(dto).toEqual({
      kind: 'HYPER',
      startedAt: '2026-08-05T22:00:00.000Z',
      endedAt: '2026-08-05T22:25:00.000Z',
      durationMin: 25,
      minGlucose: 185,
      maxGlucose: 240,
    });
  });
});

describe('mapInsulinByTypeRow / mapAlertsByTypeRow — Prisma groupBy aggregates', () => {
  it('coerces the _sum/_avg Decimal from insulinEvent.groupBy', () => {
    const dto = mapInsulinByTypeRow({
      insulinType: 'bolus',
      _sum: { doseUnits: new Prisma.Decimal('48.50') },
      _avg: { doseUnits: new Prisma.Decimal('4.85') },
      _count: 10,
    });
    expect(dto).toEqual({ insulinType: 'bolus', totalUnits: 48.5, avgUnits: 4.85, count: 10 });
  });

  it('passes the plain _count through from alertEvent.groupBy', () => {
    expect(mapAlertsByTypeRow({ alertType: 'HYPO_RISK', _count: 7 })).toEqual({
      alertType: 'HYPO_RISK',
      count: 7,
    });
  });
});

describe('mapZonesRow', () => {
  it('coerces Decimal percents into numbers per zone', () => {
    expect(
      mapZonesRow({
        very_low_percent: new Prisma.Decimal('12.50'),
        low_percent: new Prisma.Decimal('25.00'),
        target_percent: '25.00',
        high_percent: new Prisma.Decimal('25.00'),
        very_high_percent: new Prisma.Decimal('12.50'),
      }),
    ).toEqual({ veryLow: 12.5, low: 25, target: 25, high: 25, veryHigh: 12.5 });
  });

  it('turns the NULL percents of an empty period, or a missing row, into zeros', () => {
    const zeros = { veryLow: 0, low: 0, target: 0, high: 0, veryHigh: 0 };
    const nulls = {
      very_low_percent: null,
      low_percent: null,
      target_percent: null,
      high_percent: null,
      very_high_percent: null,
    };

    expect(mapZonesRow(nulls)).toEqual(zeros);
    expect(mapZonesRow(undefined)).toEqual(zeros);
  });
});

describe('mapAgpRow', () => {
  it('names the five percentiles in order, rounds float noise and coerces the bigint count', () => {
    expect(
      mapAgpRow({
        hour: 8,
        percentiles: [102, 110, 100.80000000000001, 130.005, '138'],
        readings_count: 5n,
      }),
    ).toEqual({ hour: 8, p5: 102, p25: 110, p50: 100.8, p75: 130.01, p95: 138, count: 5 });
  });
});

describe('mapHeatCellRow', () => {
  it('coerces the Decimal mean, rounds it to two decimals and coerces the bigint count', () => {
    expect(
      mapHeatCellRow({
        day_of_week: 6,
        hour: 22,
        avg_glucose: new Prisma.Decimal('140.33333333333333'),
        readings_count: 3n,
      }),
    ).toEqual({ dayOfWeek: 6, hour: 22, avgGlucose: 140.33, count: 3 });
  });
});

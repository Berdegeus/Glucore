import { BadRequestError } from '@glucore/shared';
import { describe, expect, it } from 'vitest';

import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import type { DashboardQuery } from '../../src/modules/dashboard/dashboard.schema';
import { FakeDashboardRepository, FakePatientRepository, FakeTimeZoneChecker } from '../helpers/fakes';

const USER = 'user-1';

function build() {
  const dashboard = new FakeDashboardRepository();
  const patients = new FakePatientRepository();
  return { dashboard, patients, service: new DashboardService(dashboard, patients, new FakeTimeZoneChecker()) };
}

function query(overrides: Partial<DashboardQuery> = {}): DashboardQuery {
  return {
    from: new Date('2026-08-01T00:00:00.000Z'),
    to: new Date('2026-08-14T00:00:00.000Z'),
    bucket: 'day',
    tz: 'UTC',
    ...overrides,
  };
}

describe('DashboardService — threshold resolution', () => {
  it('uses the configured AlertThresholdConfig when one exists', async () => {
    const { dashboard, service } = build();
    dashboard.thresholdConfig = { lowGlucoseMgDl: 70, highGlucoseMgDl: 200 };

    await service.getSummaryForUser(USER, query());

    expect(dashboard.thresholdsSeen[0]).toEqual({ low: 70, high: 200 });
  });

  it('falls back to the patient target range when no config row exists', async () => {
    const { dashboard, patients, service } = build();
    dashboard.thresholdConfig = null;
    patients.rows.set(USER, {
      birthDate: null,
      diabetesType: null,
      weightKg: null,
      targetRangeMin: 65,
      targetRangeMax: 190,
    });

    await service.getSummaryForUser(USER, query());

    expect(dashboard.thresholdsSeen[0]).toEqual({ low: 65, high: 190 });
  });

  it('falls back to 80/180 when neither a config row nor a patient row exists', async () => {
    const { dashboard, service } = build();
    dashboard.thresholdConfig = null;

    await service.getSummaryForUser(USER, query());

    expect(dashboard.thresholdsSeen[0]).toEqual({ low: 80, high: 180 });
  });
});

describe('DashboardService — date range', () => {
  it('pushes the exclusive upper bound one day past the inclusive `to`', async () => {
    const { dashboard, service } = build();
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-14T00:00:00.000Z');

    await service.getSummaryForUser(USER, query({ from, to }));

    expect(dashboard.rangesSeen[0]).toEqual({
      from,
      toExclusive: new Date('2026-08-15T00:00:00.000Z'),
    });
  });
});

describe('DashboardService — response shape', () => {
  it('echoes from/to as calendar dates and passes every aggregate through untouched', async () => {
    const { dashboard, service } = build();
    dashboard.totals = { readingsCount: 10, carbEntries: 2, insulinEntries: 3, alertsCount: 1 };
    dashboard.periodMetrics = {
      avgGlucose: 140,
      gmiPercent: 6.6,
      cvPercent: 30,
      timeInRangePercent: 72.5,
      readingsCount: 10,
    };
    dashboard.insulinByType = [{ insulinType: 'bolus', totalUnits: 12, count: 3, avgUnits: 4 }];
    dashboard.alertsByType = [{ alertType: 'HYPO_RISK', count: 2 }];
    dashboard.excursions = [
      {
        kind: 'HYPO',
        startedAt: '2026-08-05T10:00:00.000Z',
        endedAt: '2026-08-05T10:20:00.000Z',
        durationMin: 20,
        minGlucose: 60,
        maxGlucose: 68,
      },
    ];

    const result = await service.getSummaryForUser(USER, query());

    expect(result).toEqual({
      from: '2026-08-01',
      to: '2026-08-14',
      tz: 'UTC',
      lastReadingAt: null,
      sensorUsePercent: expect.any(Number),
      zoneDistribution: dashboard.zoneDistribution,
      agp: [],
      heatmap: [],
      totals: dashboard.totals,
      timeInRangePercent: 72.5,
      gmiPercent: 6.6,
      coefficientOfVariationPercent: 30,
      byDay: [],
      insulinByType: dashboard.insulinByType,
      alertsByType: dashboard.alertsByType,
      excursions: dashboard.excursions,
    });
  });
});

describe('DashboardService — time zone check', () => {
  it('answers 400 INVALID_TIMEZONE for a zone the database does not know, before touching any data', async () => {
    const { dashboard, patients, service } = build();

    const failure = await service.getSummaryForUser(USER, query({ tz: 'Mars/Phobos' })).catch((e) => e);

    expect(failure).toBeInstanceOf(BadRequestError);
    expect(failure.status).toBe(400);
    expect(failure.code).toBe('INVALID_TIMEZONE');
    expect(patients.ensured).toEqual([]);
    expect(dashboard.rangesSeen).toEqual([]);
  });

  it('lets a known zone through', async () => {
    const { dashboard, service } = build();

    await service.getSummaryForUser(USER, query({ tz: 'America/Sao_Paulo' }));

    expect(dashboard.rangesSeen).toHaveLength(1);
  });
});

describe('DashboardService — extended summary', () => {
  it('adds tz, lastReadingAt, zoneDistribution, agp and heatmap as the repository answered them', async () => {
    const { dashboard, service } = build();
    dashboard.lastReadingAt = '2026-09-20T08:05:00.000Z';
    dashboard.zoneDistribution = { veryLow: 1, low: 4, target: 70, high: 20, veryHigh: 5 };
    dashboard.agp = [{ hour: 8, p5: 90, p25: 100, p50: 120, p75: 140, p95: 170, count: 30 }];
    dashboard.heatmap = [{ dayOfWeek: 1, hour: 9, avgGlucose: 105.5, count: 2 }];

    const result = await service.getSummaryForUser(USER, query({ tz: 'America/Sao_Paulo' }));

    expect(result).toMatchObject({
      tz: 'America/Sao_Paulo',
      lastReadingAt: '2026-09-20T08:05:00.000Z',
      zoneDistribution: { veryLow: 1, low: 4, target: 70, high: 20, veryHigh: 5 },
      agp: dashboard.agp,
      heatmap: dashboard.heatmap,
    });
  });

  it('passes the zone to every zone-aware repository call', async () => {
    const { dashboard, service } = build();

    await service.getSummaryForUser(USER, query({ tz: 'America/Sao_Paulo' }));

    expect(dashboard.tzSeen).toEqual({
      resolveBounds: ['America/Sao_Paulo'],
      getAgp: ['America/Sao_Paulo'],
      getHeatmap: ['America/Sao_Paulo'],
      getDailyBuckets: ['America/Sao_Paulo'],
    });
  });

  it('queries the window the repository resolved for the zone, not its own UTC arithmetic', async () => {
    const { dashboard, service } = build();
    dashboard.bounds = {
      from: new Date('2026-08-01T03:00:00.000Z'),
      toExclusive: new Date('2026-08-15T03:00:00.000Z'),
    };

    await service.getSummaryForUser(USER, query({ tz: 'America/Sao_Paulo' }));

    expect(dashboard.rangesSeen).toEqual([dashboard.bounds]);
  });

  // [readings, from, to, expected percent]: the period counts elapsed calendar days, both ends included.
  it.each([
    [0, '2026-08-01', '2026-08-14', 0],
    [2016, '2026-08-01', '2026-08-14', 50], // 14 days * 288 = 4032 expected
    [144, '2026-08-05', '2026-08-05', 50], // a single day is 1 day, not 0
    [287, '2026-08-05', '2026-08-05', 99.65],
    [288, '2026-08-05', '2026-08-05', 100],
    [500, '2026-08-05', '2026-08-05', 100], // capped
  ])('sensorUsePercent for %i readings from %s to %s is %d', async (readingsCount, from, to, expected) => {
    const { dashboard, service } = build();
    dashboard.periodMetrics = { ...dashboard.periodMetrics, readingsCount };

    const result = await service.getSummaryForUser(
      USER,
      query({ from: new Date(`${from}T00:00:00.000Z`), to: new Date(`${to}T00:00:00.000Z`) }),
    );

    expect(result.sensorUsePercent).toBe(expected);
  });

  it('getSummary takes the patient id as is, without creating a patient row', async () => {
    const { dashboard, patients, service } = build();

    await service.getSummary('patient-9', query());

    expect(patients.ensured).toEqual([]);
    expect(dashboard.patientIdsSeen).toEqual(['patient-9']);
  });

  it('getSummary answers 400 INVALID_TIMEZONE too, so any caller is covered', async () => {
    const { dashboard, service } = build();

    const failure = await service.getSummary('patient-9', query({ tz: 'Mars/Phobos' })).catch((e) => e);

    expect(failure).toBeInstanceOf(BadRequestError);
    expect(failure.code).toBe('INVALID_TIMEZONE');
    expect(dashboard.patientIdsSeen).toEqual([]);
  });

  it('getSummaryForUser gives the same answer as getSummary for the ensured patient id', async () => {
    const { service } = build();

    expect(await service.getSummaryForUser(USER, query())).toEqual(await service.getSummary(USER, query()));
  });
});

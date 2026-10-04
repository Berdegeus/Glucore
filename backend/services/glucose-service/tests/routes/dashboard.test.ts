import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlertType } from '@prisma/client';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll, type SignedInPatient } from '../helpers/db';

/**
 * Integration tests for `/dashboard/summary` — the only suite that exercises
 * the raw SQL, the `groupBy` aggregates and the `glucose_metrics()` stored
 * procedure for real. Nothing here mocks Prisma: the CHECK constraints and
 * the window-function/gaps-and-islands queries only mean anything against a
 * real Postgres.
 */

let app: Express;
let user: SignedInPatient;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  user = await signedInPatient();
});

afterAll(async () => {
  await disconnect();
});

const auth = () => ({ Authorization: `Bearer ${user.token}` });

/** UTC timestamp helper — every fixture below is UTC, matching `recordedAt`. */
const at = (iso: string) => new Date(iso);

/**
 * Day 1 (2026-08-05): a 20-minute sustained hypo (< 80), an in-range reading
 * breaking it, a 10-minute hyper blip too short to qualify as an excursion,
 * ANOTHER in-range reading (without it, the two hyper runs would have no
 * classification change between them and the gaps-and-islands query would
 * merge them into one long excursion instead of "one too short, one that
 * qualifies"), then a 20-minute sustained hyper (> 180).
 */
const DAY1 = [
  ['08:00', 60],
  ['08:05', 60],
  ['08:10', 60],
  ['08:15', 60],
  ['08:20', 60],
  ['08:25', 150],
  ['09:00', 250],
  ['09:05', 250],
  ['09:10', 250],
  ['09:30', 150],
  ['10:00', 220],
  ['10:05', 220],
  ['10:10', 220],
  ['10:15', 220],
  ['10:20', 220],
] as const;

/** Day 2 (2026-08-06): two in-range readings, nothing eventful. */
const DAY2 = [
  ['08:00', 140],
  ['08:10', 145],
] as const;

const DAY1_SUM = DAY1.reduce((sum, [, v]) => sum + v, 0);
const DAY1_IN_RANGE = DAY1.filter(([, v]) => v >= 80 && v <= 180).length;
const DAY1_AVG = DAY1_SUM / DAY1.length;
const DAY2_SUM = DAY2.reduce((sum, [, v]) => sum + v, 0);
const DAY2_AVG = DAY2_SUM / DAY2.length;
const PERIOD_COUNT = DAY1.length + DAY2.length;
const PERIOD_AVG = (DAY1_SUM + DAY2_SUM) / PERIOD_COUNT;
const PERIOD_IN_RANGE = DAY1_IN_RANGE + DAY2.length; // both day-2 readings are in range
const round2 = (n: number) => Math.round(n * 100) / 100;

async function seedGlucoseFixture(patientId: string): Promise<void> {
  await prisma.glucoseReading.createMany({
    data: [
      ...DAY1.map(([time, value]) => ({
        patientId,
        recordedAt: at(`2026-08-05T${time}:00.000Z`),
        valueMgDl: value,
      })),
      ...DAY2.map(([time, value]) => ({
        patientId,
        recordedAt: at(`2026-08-06T${time}:00.000Z`),
        valueMgDl: value,
      })),
    ],
  });
}

async function seedDiaryFixture(patientId: string): Promise<void> {
  await prisma.insulinEvent.createMany({
    data: [
      { patientId, eventAt: at('2026-08-05T08:00:00.000Z'), insulinType: 'bolus', doseUnits: 4, description: '' },
      { patientId, eventAt: at('2026-08-05T13:00:00.000Z'), insulinType: 'bolus', doseUnits: 6, description: '' },
      { patientId, eventAt: at('2026-08-05T22:00:00.000Z'), insulinType: 'basal', doseUnits: 20, description: '' },
    ],
  });
  await prisma.carbEvent.createMany({
    data: [
      { patientId, eventAt: at('2026-08-05T08:00:00.000Z'), carbsGrams: 45, description: 'breakfast' },
      { patientId, eventAt: at('2026-08-05T13:00:00.000Z'), carbsGrams: 60, description: 'lunch' },
      { patientId, eventAt: at('2026-08-06T08:00:00.000Z'), carbsGrams: 30, description: 'snack' },
    ],
  });
  await prisma.alertEvent.createMany({
    data: [
      { patientId, triggeredAt: at('2026-08-05T08:00:00.000Z'), alertType: AlertType.HYPO_RISK },
      { patientId, triggeredAt: at('2026-08-05T08:20:00.000Z'), alertType: AlertType.HYPO_RISK },
      { patientId, triggeredAt: at('2026-08-05T10:20:00.000Z'), alertType: AlertType.SENSOR_RECONNECTED },
    ],
  });
}

describe('GET /dashboard/summary', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/dashboard/summary')).status).toBe(401);
  });

  it('answers zeroed-out totals and empty arrays for a patient with no data', async () => {
    const res = await request(app).get('/dashboard/summary').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      readingsCount: 0,
      carbEntries: 0,
      insulinEntries: 0,
      alertsCount: 0,
    });
    expect(res.body.byDay).toEqual([]);
    expect(res.body.insulinByType).toEqual([]);
    expect(res.body.alertsByType).toEqual([]);
    expect(res.body.excursions).toEqual([]);
    expect(res.body.gmiPercent).toBeNull();
  });

  describe('with a full fixture (2026-08-05 to 2026-08-06)', () => {
    beforeEach(async () => {
      await seedGlucoseFixture(user.userId);
      await seedDiaryFixture(user.userId);
    });

    it('counts totals across the whole range', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-08-05&to=2026-08-06')
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.totals).toEqual({
        readingsCount: PERIOD_COUNT,
        carbEntries: 3,
        insulinEntries: 3,
        alertsCount: 3,
      });
    });

    it('groups insulin by type with Prisma groupBy (_sum/_avg/_count)', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-08-05&to=2026-08-06')
        .set(auth());

      const byType = [...res.body.insulinByType].sort((a: { insulinType: string }, b: { insulinType: string }) =>
        a.insulinType.localeCompare(b.insulinType),
      );
      expect(byType).toEqual([
        { insulinType: 'basal', totalUnits: 20, avgUnits: 20, count: 1 },
        { insulinType: 'bolus', totalUnits: 10, avgUnits: 5, count: 2 },
      ]);
    });

    it('groups alerts by type with Prisma groupBy', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-08-05&to=2026-08-06')
        .set(auth());

      const byType = [...res.body.alertsByType].sort((a: { alertType: string }, b: { alertType: string }) =>
        a.alertType.localeCompare(b.alertType),
      );
      expect(byType).toEqual([
        { alertType: 'HYPO_RISK', count: 2 },
        { alertType: 'SENSOR_RECONNECTED', count: 1 },
      ]);
    });

    it('buckets glucose by day with date_trunc, min/max/avg and time-in-range', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-08-05&to=2026-08-06')
        .set(auth());

      expect(res.body.byDay).toEqual([
        {
          day: '2026-08-05',
          avgGlucose: expect.closeTo(DAY1_AVG, 3),
          minGlucose: 60,
          maxGlucose: 250,
          timeInRangePercent: round2((100 * DAY1_IN_RANGE) / DAY1.length),
          // First row in the window: no preceding day, so it is its own average.
          movingAvg7d: expect.closeTo(DAY1_AVG, 3),
          readingsCount: DAY1.length,
        },
        {
          day: '2026-08-06',
          avgGlucose: DAY2_AVG,
          minGlucose: 140,
          maxGlucose: 145,
          timeInRangePercent: 100,
          // The window averages the two days' own averages, not weighted by
          // reading count: (day1Avg + day2Avg) / 2.
          movingAvg7d: expect.closeTo((DAY1_AVG + DAY2_AVG) / 2, 3),
          readingsCount: DAY2.length,
        },
      ]);
    });

    it('computes GMI/CV/TIR for the whole period via the glucose_metrics() stored procedure', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-08-05&to=2026-08-06')
        .set(auth());

      expect(res.body.gmiPercent).toBeCloseTo(3.31 + 0.02392 * PERIOD_AVG, 4);
      expect(res.body.coefficientOfVariationPercent).toBeGreaterThan(0);
      expect(res.body.timeInRangePercent).toBeCloseTo(round2((100 * PERIOD_IN_RANGE) / PERIOD_COUNT), 2);
    });

    it('finds sustained excursions (>= 15 min) and excludes the 10-minute blip', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-08-05&to=2026-08-06')
        .set(auth());

      expect(res.body.excursions).toEqual([
        expect.objectContaining({
          kind: 'HYPO',
          startedAt: '2026-08-05T08:00:00.000Z',
          endedAt: '2026-08-05T08:20:00.000Z',
          durationMin: 20,
          minGlucose: 60,
          maxGlucose: 60,
        }),
        expect.objectContaining({
          kind: 'HYPER',
          startedAt: '2026-08-05T10:00:00.000Z',
          endedAt: '2026-08-05T10:20:00.000Z',
          durationMin: 20,
          minGlucose: 220,
          maxGlucose: 220,
        }),
      ]);
      // The 09:00-09:10 hyper blip is only 10 minutes and must not appear.
      expect(res.body.excursions).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('rejects a bucket other than day', async () => {
      const res = await request(app).get('/dashboard/summary?bucket=hour').set(auth());
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DASHBOARD_RANGE');
    });

    it('rejects from after to', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-08-10&to=2026-08-01')
        .set(auth());
      expect(res.status).toBe(400);
    });

    it('rejects a span over 90 days', async () => {
      const res = await request(app)
        .get('/dashboard/summary?from=2026-01-01&to=2026-08-01')
        .set(auth());
      expect(res.status).toBe(400);
    });
  });
});

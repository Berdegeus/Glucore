import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlertType } from '@prisma/client';

import { signAccessToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll, type SignedInPatient } from '../helpers/db';
import { TEST_JWT_SECRET } from '../helpers/testEnv';

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
          carbsGrams: 105,
          insulinUnits: 30,
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
          carbsGrams: 30,
          insulinUnits: 0,
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

  describe('with a full fixture, the extended summary', () => {
    const PERIOD = '/dashboard/summary?from=2026-08-05&to=2026-08-06';

    beforeEach(async () => {
      await seedGlucoseFixture(user.userId);
      await seedDiaryFixture(user.userId);
    });

    // The keys the endpoint answered before `tz` existed, and the ones added since (API-08: additive only).
    const OLD_KEYS = [
      'alertsByType',
      'byDay',
      'coefficientOfVariationPercent',
      'excursions',
      'from',
      'gmiPercent',
      'insulinByType',
      'timeInRangePercent',
      'to',
      'totals',
    ];
    const NEW_KEYS = ['agp', 'heatmap', 'lastReadingAt', 'sensorUsePercent', 'tz', 'zoneDistribution'];

    type DayRow = { day: string; readingsCount: number; avgGlucose: number | null };
    const pickDays = (byDay: DayRow[]) => byDay.map((d) => [d.day, d.readingsCount]);

    it('without tz answers every old key with its old value, next to the new keys', async () => {
      const res = await request(app).get(PERIOD).set(auth());

      expect(Object.keys(res.body).sort()).toEqual([...OLD_KEYS, ...NEW_KEYS].sort());
      expect(res.body).toMatchObject({
        from: '2026-08-05',
        to: '2026-08-06',
        totals: { readingsCount: PERIOD_COUNT, carbEntries: 3, insulinEntries: 3, alertsCount: 3 },
        timeInRangePercent: round2((100 * PERIOD_IN_RANGE) / PERIOD_COUNT),
        gmiPercent: expect.closeTo(3.31 + 0.02392 * PERIOD_AVG, 4),
      });
      expect(pickDays(res.body.byDay)).toEqual([
        ['2026-08-05', DAY1.length],
        ['2026-08-06', DAY2.length],
      ]);
      expect(res.body.excursions).toHaveLength(2);
    });

    it('answers the same body for an omitted tz and for tz=UTC', async () => {
      const omitted = await request(app).get(PERIOD).set(auth());
      const explicit = await request(app).get(`${PERIOD}&tz=UTC`).set(auth());

      expect(explicit.body).toEqual(omitted.body);
      expect(omitted.body.tz).toBe('UTC');
    });

    it('adds the carbs and insulin of each day to byDay', async () => {
      const res = await request(app).get(PERIOD).set(auth());

      expect(
        res.body.byDay.map((d: { carbsGrams: number; insulinUnits: number }) => [d.carbsGrams, d.insulinUnits]),
      ).toEqual([
        [105, 30],
        [30, 0],
      ]);
    });

    it('splits the readings across the five zones, summing to 100', async () => {
      const res = await request(app).get(PERIOD).set(auth());

      // 5 readings at 60 (low), 4 in range, 8 above 180 (none over 250), out of 17.
      expect(res.body.zoneDistribution).toEqual({ veryLow: 0, low: 29.41, target: 23.53, high: 47.06, veryHigh: 0 });
    });

    it('answers the sensor use as readings over 288 a day, for the two days of the period', async () => {
      const res = await request(app).get(PERIOD).set(auth());

      expect(res.body.sensorUsePercent).toBe(round2((PERIOD_COUNT / (2 * 288)) * 100));
    });

    it('answers the AGP percentiles per hour, with the hours that have readings only', async () => {
      const res = await request(app).get(PERIOD).set(auth());

      expect(res.body.agp.map((p: { hour: number; count: number }) => [p.hour, p.count])).toEqual([
        [8, 8],
        [9, 4],
        [10, 5],
      ]);
      // 09:xx readings sorted: 150, 250, 250, 250 — linear interpolation between them.
      expect(res.body.agp[1]).toEqual({ hour: 9, p5: 165, p25: 225, p50: 250, p75: 250, p95: 250, count: 4 });
    });

    it('answers the heatmap per weekday and hour (2026-08-05 is a Wednesday)', async () => {
      const res = await request(app).get(PERIOD).set(auth());

      expect(res.body.heatmap).toEqual([
        { dayOfWeek: 3, hour: 8, avgGlucose: 75, count: 6 },
        { dayOfWeek: 3, hour: 9, avgGlucose: 225, count: 4 },
        { dayOfWeek: 3, hour: 10, avgGlucose: 220, count: 5 },
        { dayOfWeek: 4, hour: 8, avgGlucose: 142.5, count: 2 },
      ]);
    });

    it('answers the latest reading even when it is after the period asked for', async () => {
      await prisma.glucoseReading.create({
        data: { patientId: user.userId, recordedAt: at('2026-09-20T08:05:00.000Z'), valueMgDl: 100 },
      });

      const res = await request(app).get(PERIOD).set(auth());

      expect(res.body.lastReadingAt).toBe('2026-09-20T08:05:00.000Z');
      expect(res.body.totals.readingsCount).toBe(PERIOD_COUNT);
    });
  });

  describe('time zones', () => {
    const BRT = 'America/Sao_Paulo';
    const day5 = (tz?: string) =>
      `/dashboard/summary?from=2026-08-05&to=2026-08-05${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`;
    const dayAndAvg = (byDay: Array<{ day: string; avgGlucose: number | null }>) =>
      byDay.map((d) => [d.day, d.avgGlucose]);

    beforeEach(async () => {
      // Local midnights in Sao Paulo (UTC-3): 2026-08-05T03:00Z and 2026-08-06T03:00Z.
      await prisma.glucoseReading.createMany({
        data: [
          { patientId: user.userId, recordedAt: at('2026-08-05T02:59:00.000Z'), valueMgDl: 100 }, // 08-04 23:59 BRT
          { patientId: user.userId, recordedAt: at('2026-08-05T03:00:00.000Z'), valueMgDl: 110 }, // 08-05 00:00 BRT
          { patientId: user.userId, recordedAt: at('2026-08-06T02:59:00.000Z'), valueMgDl: 120 }, // 08-05 23:59 BRT
          { patientId: user.userId, recordedAt: at('2026-08-06T03:00:00.000Z'), valueMgDl: 130 }, // 08-06 00:00 BRT
        ],
      });
    });

    it('with tz=America/Sao_Paulo counts the local day: from 03:00Z, up to but not including the next 03:00Z', async () => {
      const res = await request(app).get(day5(BRT)).set(auth());

      expect(res.status).toBe(200);
      expect(res.body.tz).toBe(BRT);
      expect(res.body.totals.readingsCount).toBe(2);
      expect(dayAndAvg(res.body.byDay)).toEqual([['2026-08-05', 115]]);
    });

    it('the same dates in UTC cover another window, so the days change', async () => {
      const res = await request(app).get(day5()).set(auth());

      // 02:59Z and 03:00Z are both still 2026-08-05 in UTC; the 23:59 BRT reading is already 08-06.
      expect(res.body.totals.readingsCount).toBe(2);
      expect(dayAndAvg(res.body.byDay)).toEqual([['2026-08-05', 105]]);
    });

    it('labels each reading with its local day, which differs from the UTC day', async () => {
      const wide = (tz: string) => `/dashboard/summary?from=2026-08-04&to=2026-08-06&tz=${tz}`;

      const local = await request(app).get(wide(BRT)).set(auth());
      const utc = await request(app).get(wide('UTC')).set(auth());

      expect(dayAndAvg(local.body.byDay)).toEqual([
        ['2026-08-04', 100],
        ['2026-08-05', 115],
        ['2026-08-06', 130],
      ]);
      expect(dayAndAvg(utc.body.byDay)).toEqual([
        ['2026-08-05', 105],
        ['2026-08-06', 125],
      ]);
    });

    it('moves the hours of the AGP and the heatmap to the local clock', async () => {
      const res = await request(app).get(day5(BRT)).set(auth());

      expect(res.body.agp.map((p: { hour: number }) => p.hour)).toEqual([0, 23]);
      expect(res.body.heatmap.map((c: { dayOfWeek: number; hour: number }) => [c.dayOfWeek, c.hour])).toEqual([
        [3, 0],
        [3, 23],
      ]);
    });

    it('lists a local day that has only carbs, with null glucose', async () => {
      await prisma.carbEvent.create({
        data: { patientId: user.userId, eventAt: at('2026-08-07T15:00:00.000Z'), carbsGrams: 40, description: '' },
      });

      const res = await request(app).get(`/dashboard/summary?from=2026-08-05&to=2026-08-07&tz=${BRT}`).set(auth());

      expect(res.body.byDay[2]).toEqual({
        day: '2026-08-07',
        avgGlucose: null,
        minGlucose: null,
        maxGlucose: null,
        timeInRangePercent: null,
        movingAvg7d: null,
        readingsCount: 0,
        carbsGrams: 40,
        insulinUnits: 0,
      });
    });

    it.each(['Mars/Phobos', 'not a zone!', ''])('answers 400 INVALID_TIMEZONE for tz=%j', async (tz) => {
      const res = await request(app).get(`/dashboard/summary?tz=${encodeURIComponent(tz)}`).set(auth());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIMEZONE');
    });
  });

  describe('role', () => {
    it.each(['HEALTH_PROFESSIONAL', 'ADMINISTRATOR'] as const)('answers 403 FORBIDDEN_ROLE to a %s token', async (role) => {
      const token = signAccessToken({ sub: user.userId, role }, TEST_JWT_SECRET);

      const res = await request(app).get('/dashboard/summary').set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
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

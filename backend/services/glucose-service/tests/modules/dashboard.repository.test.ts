import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaDashboardRepository } from '../../src/modules/dashboard/dashboard.repository';
import type { DateRange } from '../../src/modules/dashboard/dashboard.repository';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';

/**
 * Integration tests for the repository methods that need a real Postgres:
 * time-zone arithmetic, `AT TIME ZONE` and the SQL functions. The route suite
 * covers the endpoint; this one pins each query on its own.
 */

const repository = new PrismaDashboardRepository(prisma);

afterAll(async () => {
  await disconnect();
});

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** The window every fixture below lives in: 2026-08-05, UTC. */
const RANGE: DateRange = { from: day('2026-08-05'), toExclusive: day('2026-08-06') };

/** Seeds one reading per value, five minutes apart from 08:00 UTC on 2026-08-05. */
async function seedReadings(patientId: string, values: number[], date = '2026-08-05'): Promise<void> {
  await prisma.glucoseReading.createMany({
    data: values.map((valueMgDl, i) => ({
      patientId,
      valueMgDl,
      recordedAt: new Date(Date.parse(`${date}T08:00:00.000Z`) + i * 5 * 60_000),
    })),
  });
}

const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

describe('resolveBounds', () => {
  it('UTC gives midnight-to-midnight of the same dates, plus one day on the exclusive end', async () => {
    const bounds = await repository.resolveBounds(day('2026-08-01'), day('2026-08-14'), 'UTC');

    expect(bounds.from).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-08-15T00:00:00.000Z'));
  });

  it('America/Sao_Paulo starts at 03:00 UTC', async () => {
    const bounds = await repository.resolveBounds(day('2026-08-01'), day('2026-08-14'), 'America/Sao_Paulo');

    expect(bounds.from).toEqual(new Date('2026-08-01T03:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-08-15T03:00:00.000Z'));
  });

  it('a single day is 23 hours long when New York springs forward', async () => {
    const bounds = await repository.resolveBounds(day('2026-03-08'), day('2026-03-08'), 'America/New_York');

    expect(bounds.from).toEqual(new Date('2026-03-08T05:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-03-09T04:00:00.000Z'));
    expect(hoursBetween(bounds.from, bounds.toExclusive)).toBe(23);
  });

  it('a single day is 25 hours long when New York falls back', async () => {
    const bounds = await repository.resolveBounds(day('2026-11-01'), day('2026-11-01'), 'America/New_York');

    expect(bounds.from).toEqual(new Date('2026-11-01T04:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-11-02T05:00:00.000Z'));
    expect(hoursBetween(bounds.from, bounds.toExclusive)).toBe(25);
  });

  it('a period crossing the spring change is one hour short of whole days', async () => {
    const bounds = await repository.resolveBounds(day('2026-03-07'), day('2026-03-09'), 'America/New_York');

    expect(hoursBetween(bounds.from, bounds.toExclusive)).toBe(3 * 24 - 1);
  });
});

describe('getZoneDistribution', () => {
  let patientId: string;

  beforeEach(async () => {
    await truncateAll();
    patientId = (await signedInPatient()).userId;
  });

  const ZONES = ['veryLow', 'low', 'target', 'high', 'veryHigh'] as const;

  // [low, high, value, expected zone] — every boundary with a sample just below and exactly at it.
  it.each([
    [80, 180, 53, 'veryLow'],
    [80, 180, 54, 'low'],
    [80, 180, 79, 'low'],
    [80, 180, 80, 'target'],
    [80, 180, 180, 'target'],
    [80, 180, 181, 'high'],
    [80, 180, 250, 'high'],
    [80, 180, 251, 'veryHigh'],
    // A low threshold under 54 moves the very-low edge to it: no "low" band is left.
    [50, 180, 49, 'veryLow'],
    [50, 180, 50, 'target'],
    [50, 180, 53, 'target'],
    // A high threshold over 250 moves the very-high edge to it: no "high" band is left.
    [80, 300, 251, 'target'],
    [80, 300, 300, 'target'],
    [80, 300, 301, 'veryHigh'],
  ] as const)('low=%i high=%i: %i mg/dL is %s', async (low, high, value, zone) => {
    await seedReadings(patientId, [value]);

    const distribution = await repository.getZoneDistribution(patientId, RANGE, low, high);

    expect(distribution).toEqual({ veryLow: 0, low: 0, target: 0, high: 0, veryHigh: 0, [zone]: 100 });
  });

  it('splits the eight boundary readings across the five zones and sums to 100', async () => {
    await seedReadings(patientId, [53, 54, 79, 80, 180, 181, 250, 251]);

    const distribution = await repository.getZoneDistribution(patientId, RANGE, 80, 180);

    expect(distribution).toEqual({ veryLow: 12.5, low: 25, target: 25, high: 25, veryHigh: 12.5 });
  });

  it('sums to 100 within 0.01 when the shares do not divide evenly', async () => {
    // 7 readings -> 14.2857 / 28.5714 / 14.2857 / 28.5714 / 14.2857: five independent roundings add up to 100.01.
    await seedReadings(patientId, [40, 60, 60, 100, 200, 200, 300]);

    const distribution = await repository.getZoneDistribution(patientId, RANGE, 80, 180);
    const sum = ZONES.reduce((total, zone) => total + distribution[zone], 0);

    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
    // Each share stays within 0.01 of its exact value (100/7 or 200/7).
    const exact = { veryLow: 100 / 7, low: 200 / 7, target: 100 / 7, high: 200 / 7, veryHigh: 100 / 7 };
    for (const zone of ZONES) {
      expect(Math.abs(distribution[zone] - exact[zone])).toBeLessThan(0.01);
    }
  });

  it('counts only readings inside [from, toExclusive)', async () => {
    await seedReadings(patientId, [100]);
    await seedReadings(patientId, [300], '2026-08-06'); // exactly at toExclusive: out
    await seedReadings(patientId, [40], '2026-08-04'); // before from: out

    const distribution = await repository.getZoneDistribution(patientId, RANGE, 80, 180);

    expect(distribution.target).toBe(100);
  });

  it("ignores another patient's readings", async () => {
    const other = (await signedInPatient()).userId;
    await seedReadings(patientId, [100]);
    await seedReadings(other, [300, 300, 300]);

    const distribution = await repository.getZoneDistribution(patientId, RANGE, 80, 180);

    expect(distribution.target).toBe(100);
  });

  it('answers zero in every zone when there are no readings', async () => {
    const distribution = await repository.getZoneDistribution(patientId, RANGE, 80, 180);

    expect(distribution).toEqual({ veryLow: 0, low: 0, target: 0, high: 0, veryHigh: 0 });
  });
});

describe('getAgp', () => {
  let patientId: string;

  beforeEach(async () => {
    await truncateAll();
    patientId = (await signedInPatient()).userId;
  });

  const atUtc = (time: string, date = '2026-08-05') => new Date(`${date}T${time}:00.000Z`);

  async function seedAt(owner: string, time: string, values: number[], date?: string): Promise<void> {
    await prisma.glucoseReading.createMany({
      data: values.map((valueMgDl, i) => ({
        patientId: owner,
        valueMgDl,
        recordedAt: new Date(atUtc(time, date).getTime() + i * 60_000),
      })),
    });
  }

  it('computes P5/P25/P50/P75/P95 and the count for a known set of readings', async () => {
    // Linear interpolation over [100,110,120,130,140]: P5 at index 0.2, P95 at index 3.8.
    await seedAt(patientId, '08:00', [140, 100, 120, 110, 130]);

    const agp = await repository.getAgp(patientId, RANGE, 'UTC');

    expect(agp).toEqual([{ hour: 8, p5: 102, p25: 110, p50: 120, p75: 130, p95: 138, count: 5 }]);
  });

  it('groups by local hour: 08:00 UTC is 05:00 in America/Sao_Paulo', async () => {
    await seedAt(patientId, '08:00', [100, 120]);

    const agp = await repository.getAgp(patientId, RANGE, 'America/Sao_Paulo');

    expect(agp.map((point) => point.hour)).toEqual([5]);
  });

  it('wraps to the previous evening: 02:30 UTC is 23:xx in America/Sao_Paulo', async () => {
    await seedAt(patientId, '02:30', [90]);

    const agp = await repository.getAgp(patientId, RANGE, 'America/Sao_Paulo');

    expect(agp).toEqual([{ hour: 23, p5: 90, p25: 90, p50: 90, p75: 90, p95: 90, count: 1 }]);
  });

  it('leaves out hours without readings and orders the rest by hour', async () => {
    await seedAt(patientId, '15:00', [150]);
    await seedAt(patientId, '03:00', [90]);

    const agp = await repository.getAgp(patientId, RANGE, 'UTC');

    expect(agp.map((point) => point.hour)).toEqual([3, 15]);
  });

  it('ignores readings outside the range and from other patients', async () => {
    const other = (await signedInPatient()).userId;
    await seedAt(patientId, '08:00', [100]);
    await seedAt(patientId, '08:00', [300], '2026-08-06'); // at toExclusive: out
    await seedAt(other, '08:00', [400]);

    const agp = await repository.getAgp(patientId, RANGE, 'UTC');

    expect(agp).toEqual([{ hour: 8, p5: 100, p25: 100, p50: 100, p75: 100, p95: 100, count: 1 }]);
  });

  it('answers an empty list when the period has no readings', async () => {
    expect(await repository.getAgp(patientId, RANGE, 'UTC')).toEqual([]);
  });
});

describe('getHeatmap', () => {
  let patientId: string;

  // 2026-08-08 is a Saturday. The range covers Saturday through Monday, UTC.
  const WEEKEND: DateRange = { from: day('2026-08-08'), toExclusive: day('2026-08-11') };

  beforeEach(async () => {
    await truncateAll();
    patientId = (await signedInPatient()).userId;
  });

  async function seed(owner: string, readings: Array<[iso: string, value: number]>): Promise<void> {
    await prisma.glucoseReading.createMany({
      data: readings.map(([iso, valueMgDl]) => ({ patientId: owner, valueMgDl, recordedAt: new Date(iso) })),
    });
  }

  it('puts Saturday 22:00 in Sao Paulo on Saturday with tz, and on Sunday with UTC', async () => {
    await seed(patientId, [['2026-08-09T01:00:00.000Z', 150]]); // Sat 22:00 BRT == Sun 01:00 UTC

    const local = await repository.getHeatmap(patientId, WEEKEND, 'America/Sao_Paulo');
    const utc = await repository.getHeatmap(patientId, WEEKEND, 'UTC');

    expect(local).toEqual([{ dayOfWeek: 6, hour: 22, avgGlucose: 150, count: 1 }]);
    expect(utc).toEqual([{ dayOfWeek: 0, hour: 1, avgGlucose: 150, count: 1 }]);
  });

  it('numbers the week from Sunday = 0', async () => {
    await seed(patientId, [
      ['2026-08-09T12:00:00.000Z', 100], // Sunday
      ['2026-08-10T12:00:00.000Z', 100], // Monday
      ['2026-08-08T12:00:00.000Z', 100], // Saturday
    ]);

    const heatmap = await repository.getHeatmap(patientId, WEEKEND, 'UTC');

    expect(heatmap.map((cell) => cell.dayOfWeek)).toEqual([0, 1, 6]);
  });

  it('averages and counts the readings that share a weekday and hour', async () => {
    await seed(patientId, [
      ['2026-08-10T09:05:00.000Z', 100],
      ['2026-08-10T09:50:00.000Z', 111],
      ['2026-08-10T10:00:00.000Z', 200],
    ]);

    const heatmap = await repository.getHeatmap(patientId, WEEKEND, 'UTC');

    expect(heatmap).toEqual([
      { dayOfWeek: 1, hour: 9, avgGlucose: 105.5, count: 2 },
      { dayOfWeek: 1, hour: 10, avgGlucose: 200, count: 1 },
    ]);
  });

  it('ignores readings outside the range and from other patients', async () => {
    const other = (await signedInPatient()).userId;
    await seed(patientId, [['2026-08-10T09:00:00.000Z', 100]]);
    await seed(patientId, [['2026-08-11T00:00:00.000Z', 300]]); // at toExclusive: out
    await seed(other, [['2026-08-10T09:00:00.000Z', 400]]);

    const heatmap = await repository.getHeatmap(patientId, WEEKEND, 'UTC');

    expect(heatmap).toEqual([{ dayOfWeek: 1, hour: 9, avgGlucose: 100, count: 1 }]);
  });

  it('answers an empty list when the period has no readings', async () => {
    expect(await repository.getHeatmap(patientId, WEEKEND, 'UTC')).toEqual([]);
  });
});

describe('getLastReadingAt', () => {
  let patientId: string;

  beforeEach(async () => {
    await truncateAll();
    patientId = (await signedInPatient()).userId;
  });

  it('is null for a patient without readings', async () => {
    expect(await repository.getLastReadingAt(patientId)).toBeNull();
  });

  it('is the most recent reading, even when it is outside the period being viewed', async () => {
    await seedReadings(patientId, [100], '2026-08-05'); // inside RANGE
    await seedReadings(patientId, [100, 110], '2026-09-20'); // weeks after RANGE; latest is 08:05

    expect(await repository.getLastReadingAt(patientId)).toBe('2026-09-20T08:05:00.000Z');
  });

  it("does not pick up another patient's newer reading", async () => {
    const other = (await signedInPatient()).userId;
    await seedReadings(patientId, [100], '2026-08-05');
    await seedReadings(other, [100], '2026-09-20');

    expect(await repository.getLastReadingAt(patientId)).toBe('2026-08-05T08:00:00.000Z');
  });
});

describe('getDailyBuckets', () => {
  let patientId: string;

  // Four days around 2026-08-05, so the carb-only / insulin-only cases have room on both sides.
  const WINDOW: DateRange = { from: day('2026-08-04'), toExclusive: day('2026-08-08') };

  beforeEach(async () => {
    await truncateAll();
    patientId = (await signedInPatient()).userId;
  });

  const readingAt = (iso: string, valueMgDl: number, owner = patientId) =>
    prisma.glucoseReading.create({ data: { patientId: owner, valueMgDl, recordedAt: new Date(iso) } });
  const carbsAt = (iso: string, carbsGrams: number, owner = patientId) =>
    prisma.carbEvent.create({ data: { patientId: owner, eventAt: new Date(iso), carbsGrams, description: '' } });
  const insulinAt = (iso: string, doseUnits: number, owner = patientId) =>
    prisma.insulinEvent.create({
      data: { patientId: owner, eventAt: new Date(iso), insulinType: 'bolus', doseUnits, description: '' },
    });
  const buckets = (tz = 'UTC', low = 80, high = 180, range = WINDOW) =>
    repository.getDailyBuckets(patientId, range, low, high, tz);

  it('keeps the glucose fields of a day with readings and zeroes the diary sums when it has none', async () => {
    await readingAt('2026-08-05T08:00:00.000Z', 100);
    await readingAt('2026-08-05T08:05:00.000Z', 200);

    expect(await buckets()).toEqual([
      {
        day: '2026-08-05',
        avgGlucose: 150,
        minGlucose: 100,
        maxGlucose: 200,
        timeInRangePercent: 50,
        movingAvg7d: 150,
        readingsCount: 2,
        carbsGrams: 0,
        insulinUnits: 0,
      },
    ]);
  });

  it('lists a day with only carbs, with null glucose fields and no readings', async () => {
    await carbsAt('2026-08-06T12:00:00.000Z', 45.5);
    await carbsAt('2026-08-06T19:00:00.000Z', 30);

    expect(await buckets()).toEqual([
      {
        day: '2026-08-06',
        avgGlucose: null,
        minGlucose: null,
        maxGlucose: null,
        timeInRangePercent: null,
        movingAvg7d: null,
        readingsCount: 0,
        carbsGrams: 75.5,
        insulinUnits: 0,
      },
    ]);
  });

  it('lists a day with only insulin, with null glucose fields and no readings', async () => {
    await insulinAt('2026-08-07T07:00:00.000Z', 4.5);
    await insulinAt('2026-08-07T21:00:00.000Z', 20);

    expect(await buckets()).toEqual([
      {
        day: '2026-08-07',
        avgGlucose: null,
        minGlucose: null,
        maxGlucose: null,
        timeInRangePercent: null,
        movingAvg7d: null,
        readingsCount: 0,
        carbsGrams: 0,
        insulinUnits: 24.5,
      },
    ]);
  });

  it('joins readings, carbs and insulin on the same day, ordered by day', async () => {
    await insulinAt('2026-08-07T07:00:00.000Z', 6); // insulin-only, last
    await readingAt('2026-08-05T08:00:00.000Z', 120);
    await carbsAt('2026-08-05T09:00:00.000Z', 50);
    await insulinAt('2026-08-05T09:00:00.000Z', 5);
    await carbsAt('2026-08-04T09:00:00.000Z', 10); // carb-only, first

    const result = await buckets();

    expect(result.map((b) => b.day)).toEqual(['2026-08-04', '2026-08-05', '2026-08-07']);
    expect(result[1]).toMatchObject({ readingsCount: 1, avgGlucose: 120, carbsGrams: 50, insulinUnits: 5 });
  });

  it('keeps the 7-day moving average over the days that have readings, skipping diary-only days', async () => {
    await readingAt('2026-08-04T08:00:00.000Z', 100);
    await carbsAt('2026-08-05T08:00:00.000Z', 40); // a row between the two glucose days
    await readingAt('2026-08-06T08:00:00.000Z', 200);

    const result = await buckets();

    expect(result.map((b) => b.movingAvg7d)).toEqual([100, null, 150]);
  });

  it('computes time in range with the thresholds inclusive: 80 and 180 in, 79 and 181 out', async () => {
    await readingAt('2026-08-05T08:00:00.000Z', 79);
    await readingAt('2026-08-05T08:05:00.000Z', 80);
    await readingAt('2026-08-05T08:10:00.000Z', 180);
    await readingAt('2026-08-05T08:15:00.000Z', 181);

    expect((await buckets())[0].timeInRangePercent).toBe(50);
  });

  it('cuts the days in the given zone: 02:30 UTC belongs to the previous evening in Sao Paulo', async () => {
    await readingAt('2026-08-06T02:30:00.000Z', 100);
    await carbsAt('2026-08-06T02:30:00.000Z', 20);
    await insulinAt('2026-08-06T02:30:00.000Z', 3);

    const utc = await buckets('UTC');
    const local = await buckets('America/Sao_Paulo');

    expect(utc.map((b) => b.day)).toEqual(['2026-08-06']);
    expect(local.map((b) => b.day)).toEqual(['2026-08-05']);
    expect(local[0]).toMatchObject({ readingsCount: 1, carbsGrams: 20, insulinUnits: 3 });
  });

  it('counts only rows inside [from, toExclusive) and from this patient', async () => {
    const other = (await signedInPatient()).userId;
    await carbsAt('2026-08-07T23:59:00.000Z', 10); // last minute: in
    await carbsAt('2026-08-08T00:00:00.000Z', 99); // at toExclusive: out
    await carbsAt('2026-08-03T23:59:00.000Z', 99); // before from: out
    await carbsAt('2026-08-07T10:00:00.000Z', 99, other);
    await readingAt('2026-08-07T10:00:00.000Z', 300, other);
    await insulinAt('2026-08-07T10:00:00.000Z', 99, other);

    const result = await buckets();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ day: '2026-08-07', readingsCount: 0, carbsGrams: 10, insulinUnits: 0 });
  });

  it('answers an empty list when nothing happened in the period', async () => {
    expect(await buckets()).toEqual([]);
  });
});

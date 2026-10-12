import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaDashboardRepository } from '../../src/modules/dashboard/dashboard.repository';
import { PrismaBucketRepository } from '../../src/modules/readings/buckets.repository';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';
import { BUCKET_MS, bucketOf, bucketsFromReadings, seededValues, type SeedReading } from '../helpers/histogram';

/**
 * The dashboard reads an interval from its glucose bucket when one fits and from
 * the readings otherwise, through one relation (`glucose_counts`). The proof is
 * differential: a patient who has only readings and a patient who has only the
 * buckets of those same readings must get the same figures, to the digit, in
 * every time zone: a bucket is 15 minutes aligned to UTC, so the zone the
 * dashboard asks for does not decide whether it can be used.
 */

const repository = new PrismaDashboardRepository(prisma);
const buckets = new PrismaBucketRepository(prisma);

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await disconnect();
});

/** Four days of readings, shaped like a real sensor: dense, sparse and gappy. */
function fourDays(): SeedReading[] {
  const start = Date.UTC(2026, 7, 5);
  const values = seededValues(288 + 720 + 97 + 288);
  const readings: SeedReading[] = [];
  let next = 0;
  for (let i = 0; i < 288; i += 1) readings.push({ at: start + i * 5 * MIN, mgDl: values[next++] });
  for (let i = 0; i < 720; i += 1) readings.push({ at: start + DAY + 6 * 60 * MIN + i * MIN, mgDl: values[next++] });
  for (let i = 0; i < 97; i += 1) readings.push({ at: start + 2 * DAY + i * 13 * MIN, mgDl: values[next++] });
  for (let i = 0; i < 288; i += 1) readings.push({ at: start + 3 * DAY + i * 5 * MIN, mgDl: values[next++] });
  return readings;
}

async function seedReadings(patientId: string, readings: readonly SeedReading[]): Promise<void> {
  await prisma.glucoseReading.createMany({
    data: readings.map((r) => ({ patientId, recordedAt: new Date(r.at), valueMgDl: r.mgDl })),
  });
}

/** A patient that holds `readings`, and another that holds only their buckets. */
async function pair(readings: readonly SeedReading[]) {
  const fromReadings = (await signedInPatient()).userId;
  const fromBuckets = (await signedInPatient()).userId;
  await seedReadings(fromReadings, readings);
  const all = bucketsFromReadings(readings);
  for (let i = 0; i < all.length; i += 288) await buckets.upsertMany(fromBuckets, all.slice(i, i + 288));
  return { fromReadings, fromBuckets };
}

async function figures(patientId: string, tz: string, low = 80, high = 180) {
  const range = await repository.resolveBounds(new Date('2026-08-04'), new Date('2026-08-09'), tz);
  return {
    metrics: await repository.getPeriodMetrics(patientId, range, low, high),
    zones: await repository.getZoneDistribution(patientId, range, low, high),
    byDay: await repository.getDailyBuckets(patientId, range, low, high, tz),
  };
}

describe('an interval read from its bucket equals the same interval read from the readings', () => {
  it.each([
    'UTC',
    'America/Sao_Paulo',
    'America/New_York',
    'Europe/Lisbon',
    'Asia/Kolkata', // +5:30
    'Asia/Kathmandu', // +5:45
    'Australia/Eucla', // +8:45
    'Pacific/Chatham', // +12:45, with daylight saving
    'Pacific/Kiritimati', // +14
  ])('in %s', async (tz) => {
    const { fromReadings, fromBuckets } = await pair(fourDays());

    const expected = await figures(fromReadings, tz);
    const actual = await figures(fromBuckets, tz);

    expect(expected.metrics.readingsCount).toBeGreaterThan(1300);
    expect(expected.byDay.length).toBeGreaterThanOrEqual(4);
    expect(actual).toEqual(expected);
  });

  it('across a daylight-saving change, where a local day is 23 or 25 hours', async () => {
    // 8 Nov 2026 is the day New York leaves summer time: a 25-hour day.
    const start = Date.UTC(2026, 10, 7, 12);
    const values = seededValues(3 * 288, 11);
    const readings = values.map((mgDl, i) => ({ at: start + i * 5 * MIN, mgDl }));
    const { fromReadings, fromBuckets } = await pair(readings);
    const range = await repository.resolveBounds(new Date('2026-11-07'), new Date('2026-11-10'), 'America/New_York');

    const byReadings = await repository.getDailyBuckets(fromReadings, range, 80, 180, 'America/New_York');
    const byBuckets = await repository.getDailyBuckets(fromBuckets, range, 80, 180, 'America/New_York');

    expect(byBuckets).toEqual(byReadings);
  });

  it.each([
    [70, 180],
    [90, 140],
    [50, 300],
  ])('for the target range %i-%i (a bucket does not fix it)', async (low, high) => {
    const { fromReadings, fromBuckets } = await pair(fourDays());

    const expected = await figures(fromReadings, 'America/Sao_Paulo', low, high);
    const actual = await figures(fromBuckets, 'America/Sao_Paulo', low, high);

    expect(actual).toEqual(expected);
  });

  it('counts the minute series in readingsCount and the 5-minute slots in coveredSlots', async () => {
    const readings = fourDays();
    const { fromBuckets } = await pair(readings);

    const { metrics } = await figures(fromBuckets, 'UTC');

    expect(metrics.readingsCount).toBe(readings.length);
    expect(metrics.coveredSlots).toBe(new Set(readings.map((r) => Math.floor(r.at / (5 * MIN)))).size);
  });
});

describe('when a bucket may stand in for the readings', () => {
  const T0 = Date.UTC(2026, 7, 5, 12);
  const wide = async (patientId: string) => {
    const range = await repository.resolveBounds(new Date('2026-08-05'), new Date('2026-08-05'), 'UTC');
    return repository.getPeriodMetrics(patientId, range, 80, 180);
  };

  it('is read when it lies inside the range, with no reading on the server', async () => {
    const patientId = (await signedInPatient()).userId;
    await buckets.upsertMany(patientId, [bucketOf(T0, { 100: 10, 200: 10 })]);

    expect(await wide(patientId)).toMatchObject({ avgGlucose: 150, readingsCount: 20, timeInRangePercent: 50 });
  });

  it('is ignored for an interval the range cuts, and the readings answer instead', async () => {
    const patientId = (await signedInPatient()).userId;
    await buckets.upsertMany(patientId, [bucketOf(T0, { 200: 15 })]);
    await seedReadings(patientId, [{ at: T0 + 20 * MIN, mgDl: 100 }]);
    // A range that starts in the middle of the bucket.
    const range = { from: new Date(T0 + 5 * MIN), toExclusive: new Date(T0 + 60 * MIN) };

    const metrics = await repository.getPeriodMetrics(patientId, range, 80, 180);

    expect(metrics).toMatchObject({ avgGlucose: 100, readingsCount: 1 });
  });

  it('is also ignored when the range ends inside it', async () => {
    const patientId = (await signedInPatient()).userId;
    await buckets.upsertMany(patientId, [bucketOf(T0, { 200: 15 })]);
    await seedReadings(patientId, [{ at: T0 + 2 * MIN, mgDl: 100 }]);
    // The range ends 10 minutes into the bucket.
    const range = { from: new Date(T0 - 60 * MIN), toExclusive: new Date(T0 + 10 * MIN) };

    const metrics = await repository.getPeriodMetrics(patientId, range, 80, 180);

    expect(metrics).toMatchObject({ avgGlucose: 100, readingsCount: 1 });
  });

  it('wins over the readings of the same interval, which are not counted twice', async () => {
    const patientId = (await signedInPatient()).userId;
    await seedReadings(patientId, [
      { at: T0, mgDl: 100 },
      { at: T0 + 5 * MIN, mgDl: 100 },
    ]);
    await buckets.upsertMany(patientId, [bucketOf(T0, { 100: 15 })]);

    expect((await wide(patientId)).readingsCount).toBe(15);
  });

  it('leaves the readings of the neighbouring intervals alone', async () => {
    const patientId = (await signedInPatient()).userId;
    await buckets.upsertMany(patientId, [bucketOf(T0, { 100: 15 })]);
    await seedReadings(patientId, [
      { at: T0 - 1, mgDl: 200 }, // the interval before
      { at: T0 + BUCKET_MS, mgDl: 200 }, // the interval after
    ]);

    expect(await wide(patientId)).toMatchObject({ readingsCount: 17, avgGlucose: (1500 + 400) / 17 });
  });

  it('mixes: the bucket where there is one, the readings where there is not', async () => {
    const patientId = (await signedInPatient()).userId;
    await buckets.upsertMany(patientId, [bucketOf(T0, { 100: 10 })]);
    await seedReadings(patientId, [
      { at: T0 + 2 * BUCKET_MS, mgDl: 200 },
      { at: T0 + 2 * BUCKET_MS + 5 * MIN, mgDl: 200 },
    ]);

    const metrics = await wide(patientId);

    expect(metrics).toMatchObject({ readingsCount: 12 });
    // The bucket says 3 slots (capped by 10 readings); the readings cover 2.
    expect(metrics.coveredSlots).toBe(3 + 2);
  });

  it('never reads another patient bucket', async () => {
    const mine = (await signedInPatient()).userId;
    const other = (await signedInPatient()).userId;
    await buckets.upsertMany(other, [bucketOf(T0, { 300: 15 })]);

    expect(await wide(mine)).toMatchObject({ avgGlucose: null, readingsCount: 0, coveredSlots: 0 });
  });

  it('clamps a reading outside 40..600 like the app does, so both sources agree', async () => {
    const patientId = (await signedInPatient()).userId;
    await seedReadings(patientId, [
      { at: T0, mgDl: 30 },
      { at: T0 + MIN, mgDl: 700 },
    ]);

    expect(await wide(patientId)).toMatchObject({ avgGlucose: (40 + 600) / 2 });
  });
});

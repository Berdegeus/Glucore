import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaDashboardRepository } from '../../src/modules/dashboard/dashboard.repository';
import { PrismaSummaryRepository } from '../../src/modules/readings/summaries.repository';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';
import { seededValues, summariesFromReadings, summaryOf, type SeedReading } from '../helpers/histogram';

/**
 * The dashboard reads a day from its daily summary when one fits and from the
 * readings otherwise, through one relation (`glucose_day_counts`). The proof is
 * differential: a patient who has only readings and a patient who has only the
 * summaries of those same readings must get the same figures, to the digit.
 */

const repository = new PrismaDashboardRepository(prisma);
const summaries = new PrismaSummaryRepository(prisma);

const MIN = 60_000;
const BRASILIA = -180;

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await disconnect();
});

/** Three days of readings, shaped like a real sensor: dense, sparse and gappy. */
function threeDays(): SeedReading[] {
  const day1 = Date.UTC(2026, 7, 5, 3); // 00:00 in Brasilia
  const values = seededValues(288 + 360 + 97);
  const readings: SeedReading[] = [];
  let next = 0;
  for (let i = 0; i < 288; i += 1) readings.push({ at: day1 + i * 5 * MIN, mgDl: values[next++] });
  for (let i = 0; i < 360; i += 1) readings.push({ at: day1 + 24 * 60 * MIN + i * MIN, mgDl: values[next++] });
  for (let i = 0; i < 97; i += 1) readings.push({ at: day1 + 2 * 24 * 60 * MIN + i * 13 * MIN, mgDl: values[next++] });
  return readings;
}

async function seedReadings(patientId: string, readings: readonly SeedReading[]): Promise<void> {
  await prisma.glucoseReading.createMany({
    data: readings.map((r) => ({ patientId, recordedAt: new Date(r.at), valueMgDl: r.mgDl })),
  });
}

/** A patient that holds `readings`, and another that holds only their summaries. */
async function pair(readings: readonly SeedReading[], offsetMinutes: number) {
  const fromReadings = (await signedInPatient()).userId;
  const fromSummaries = (await signedInPatient()).userId;
  await seedReadings(fromReadings, readings);
  await seedReadings(fromSummaries, readings);
  await summaries.upsertMany(fromSummaries, summariesFromReadings(readings, offsetMinutes));
  await prisma.glucoseReading.deleteMany({ where: { patientId: fromSummaries } });
  return { fromReadings, fromSummaries };
}

async function figures(patientId: string, tz: string, low = 80, high = 180) {
  const range = await repository.resolveBounds(new Date('2026-08-05'), new Date('2026-08-08'), tz);
  return {
    metrics: await repository.getPeriodMetrics(patientId, range, low, high, tz),
    zones: await repository.getZoneDistribution(patientId, range, low, high, tz),
    byDay: await repository.getDailyBuckets(patientId, range, low, high, tz),
  };
}

describe('a day read from its summary equals the same day read from the readings', () => {
  it.each([
    ['America/Sao_Paulo', BRASILIA],
    ['UTC', 0],
  ])('in %s, over three days', async (tz, offset) => {
    const { fromReadings, fromSummaries } = await pair(threeDays(), offset);

    const expected = await figures(fromReadings, tz);
    const actual = await figures(fromSummaries, tz);

    expect(expected.metrics.readingsCount).toBeGreaterThan(700);
    expect(actual).toEqual(expected);
  });

  it.each([
    [70, 180],
    [90, 140],
    [50, 300],
  ])('for the target range %i-%i (the summary does not fix it)', async (low, high) => {
    const { fromReadings, fromSummaries } = await pair(threeDays(), BRASILIA);

    const expected = await figures(fromReadings, 'America/Sao_Paulo', low, high);
    const actual = await figures(fromSummaries, 'America/Sao_Paulo', low, high);

    expect(actual).toEqual(expected);
  });

  it('counts the minute series in readingsCount and the 5-minute slots in coveredSlots', async () => {
    const readings = threeDays();
    const { fromSummaries } = await pair(readings, BRASILIA);

    const { metrics } = await figures(fromSummaries, 'America/Sao_Paulo');

    expect(metrics.readingsCount).toBe(readings.length);
    // Day 1: all 288 slots. Day 2: 360 minutes = 72 slots. Day 3: 97 readings 13 min apart.
    const day3Slots = new Set(
      readings.slice(288 + 360).map((r) => Math.floor(r.at / (5 * MIN))),
    ).size;
    expect(metrics.coveredSlots).toBe(288 + 72 + day3Slots);
  });
});

describe('when a summary may stand in for the readings', () => {
  const day = (offset: number) => Date.UTC(2026, 7, 5, 12) - offset * MIN; // local noon

  it('is read when it was cut in the offset the caller asks for', async () => {
    const patientId = (await signedInPatient()).userId;
    // No readings at all: whatever the dashboard shows can only come from the summary.
    await summaries.upsertMany(patientId, [summaryOf('2026-08-05', { 100: 50, 200: 50 })]);

    const { metrics } = await figures(patientId, 'America/Sao_Paulo');

    expect(metrics).toMatchObject({ avgGlucose: 150, readingsCount: 100, timeInRangePercent: 50 });
  });

  it('is ignored when it was cut in another offset, and the readings answer instead', async () => {
    const patientId = (await signedInPatient()).userId;
    await seedReadings(patientId, [{ at: day(BRASILIA), mgDl: 100 }]);
    // The summary says 200 mg/dL, but it was cut in UTC and the caller asks for Brasilia.
    await summaries.upsertMany(patientId, [
      summaryOf('2026-08-05', { 200: 100 }, { utcOffsetMinutes: 0 }),
    ]);

    const { metrics } = await figures(patientId, 'America/Sao_Paulo');

    expect(metrics).toMatchObject({ avgGlucose: 100, readingsCount: 1 });
  });

  it('is ignored for a day the range cuts, and the readings answer instead', async () => {
    const patientId = (await signedInPatient()).userId;
    await summaries.upsertMany(patientId, [summaryOf('2026-08-05', { 200: 100 })]);
    await seedReadings(patientId, [{ at: day(BRASILIA), mgDl: 100 }]);
    // A range that ends at 13:00 local: the day is only half inside it, the reading (noon) is.
    const from = new Date(Date.UTC(2026, 7, 5, 3));
    const range = { from, toExclusive: new Date(Date.UTC(2026, 7, 5, 16)) };

    const metrics = await repository.getPeriodMetrics(patientId, range, 80, 180, 'America/Sao_Paulo');

    expect(metrics).toMatchObject({ avgGlucose: 100, readingsCount: 1 });
  });

  it('mixes days: the summary where there is one, the readings where there is not', async () => {
    const patientId = (await signedInPatient()).userId;
    await summaries.upsertMany(patientId, [summaryOf('2026-08-05', { 100: 10 })]);
    await seedReadings(patientId, [
      { at: Date.UTC(2026, 7, 6, 15), mgDl: 200 },
      { at: Date.UTC(2026, 7, 6, 15, 5), mgDl: 200 },
    ]);

    const { metrics, byDay } = await figures(patientId, 'America/Sao_Paulo');

    expect(metrics).toMatchObject({ readingsCount: 12, coveredSlots: 2 + 10 });
    expect(byDay.map((d) => [d.day, d.readingsCount])).toEqual([
      ['2026-08-05', 10],
      ['2026-08-06', 2],
    ]);
  });

  it('never reads another patient summary', async () => {
    const mine = (await signedInPatient()).userId;
    const other = (await signedInPatient()).userId;
    await summaries.upsertMany(other, [summaryOf('2026-08-05', { 300: 100 })]);

    const { metrics } = await figures(mine, 'America/Sao_Paulo');

    expect(metrics).toMatchObject({ avgGlucose: null, readingsCount: 0, coveredSlots: 0 });
  });

  it('does not let a stored histogram double-count a day that also has readings', async () => {
    const patientId = (await signedInPatient()).userId;
    await seedReadings(patientId, [{ at: day(BRASILIA), mgDl: 100 }]);
    await summaries.upsertMany(patientId, [summaryOf('2026-08-05', { 100: 1 })]);

    const { metrics } = await figures(patientId, 'America/Sao_Paulo');

    expect(metrics.readingsCount).toBe(1);
  });
});

describe('glucose_local_offset_minutes', () => {
  const offset = async (day: string, tz: string) => {
    const [row] = await prisma.$queryRaw<{ offset: number }[]>`
      SELECT glucose_local_offset_minutes(${day}::date, ${tz}) AS "offset"
    `;
    return row.offset;
  };

  it.each([
    ['2026-08-05', 'UTC', 0],
    ['2026-08-05', 'America/Sao_Paulo', -180],
    ['2026-08-05', 'Asia/Kolkata', 330],
    ['2026-07-01', 'America/New_York', -240],
    ['2026-01-15', 'America/New_York', -300],
    // The day the clocks go forward: noon is already summer time.
    ['2026-03-08', 'America/New_York', -240],
  ])('%s in %s is %i minutes east of UTC', async (day, tz, expected) => {
    expect(await offset(day, tz)).toBe(expected);
  });
});

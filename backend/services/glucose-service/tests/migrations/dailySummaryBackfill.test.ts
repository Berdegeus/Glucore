import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';
import { HISTOGRAM_CONTRACT } from '../helpers/histogram';

/**
 * Runs the backfill section of the daily-summary migration over seeded
 * readings. The migration already ran on an empty table when the database was
 * built, so the SQL is lifted from the file and executed here, by itself.
 */
const migration = readFileSync(
  path.resolve(__dirname, '../../prisma/migrations/20261012120000_add_glucose_daily_summary/migration.sql'),
  'utf8',
);
const BACKFILL = migration.slice(migration.indexOf('-- BACKFILL') + '-- BACKFILL'.length);

const bin = (mgDl: number) => mgDl - HISTOGRAM_CONTRACT.minMgDl;

let patientId: string;

beforeEach(async () => {
  await truncateAll();
  patientId = (await signedInPatient()).userId;
});

afterAll(async () => {
  await disconnect();
});

const seed = (rows: [string, number][]) =>
  prisma.glucoseReading.createMany({
    data: rows.map(([at, valueMgDl]) => ({ patientId, recordedAt: new Date(at), valueMgDl })),
  });

const backfill = () => prisma.$executeRawUnsafe(BACKFILL);
const summaries = () => prisma.glucoseDailySummary.findMany({ orderBy: { localDate: 'asc' } });
const day = (row: { localDate: Date }) => row.localDate.toISOString().slice(0, 10);

describe('daily summary backfill', () => {
  it('has a section to run', () => {
    expect(BACKFILL).toContain('INSERT INTO "GlucoseDailySummary"');
  });

  it('cuts days in America/Sao_Paulo, not UTC', async () => {
    await seed([
      ['2026-10-10T02:30:00Z', 100], // 23:30 on the 9th in Brasilia
      ['2026-10-10T03:00:00Z', 110], // 00:00 on the 10th
      ['2026-10-10T20:00:00Z', 120], // 17:00 on the 10th
    ]);

    await backfill();

    const rows = await summaries();
    expect(rows.map(day)).toEqual(['2026-10-09', '2026-10-10']);
    expect(rows.map((r) => r.readingsCount)).toEqual([1, 2]);
    expect(rows.every((r) => r.utcOffsetMinutes === -180)).toBe(true);
  });

  it('counts readings per whole mg/dL and clamps to the edges', async () => {
    await seed([
      ['2026-10-10T15:00:00Z', 100],
      ['2026-10-10T15:01:00Z', 100],
      ['2026-10-10T15:02:00Z', 100],
      ['2026-10-10T15:03:00Z', 30], // below 40: first bin
      ['2026-10-10T15:04:00Z', 700], // above 600: last bin
    ]);

    await backfill();

    const [row] = await summaries();
    expect(row.histogram).toHaveLength(HISTOGRAM_CONTRACT.bins);
    expect(row.histogram[bin(100)]).toBe(3);
    expect(row.histogram[0]).toBe(1);
    expect(row.histogram[HISTOGRAM_CONTRACT.bins - 1]).toBe(1);
    expect(row.histogram.reduce((a, b) => a + b, 0)).toBe(5);
    expect(row.readingsCount).toBe(5);
  });

  it('counts 5-minute slots, not readings, as covered', async () => {
    await seed([
      ['2026-10-10T15:00:00Z', 100],
      ['2026-10-10T15:01:00Z', 101],
      ['2026-10-10T15:04:59Z', 102], // same slot as the two above
      ['2026-10-10T15:05:00Z', 103], // next slot
      ['2026-10-10T16:00:00Z', 104], // another slot, an hour on
    ]);

    await backfill();

    const [row] = await summaries();
    expect(row.readingsCount).toBe(5);
    expect(row.coveredSlots).toBe(3);
  });

  it('keeps patients apart', async () => {
    const other = (await signedInPatient()).userId;
    await seed([['2026-10-10T15:00:00Z', 100]]);
    await prisma.glucoseReading.create({
      data: { patientId: other, recordedAt: new Date('2026-10-10T15:00:00Z'), valueMgDl: 200 },
    });

    await backfill();

    const rows = await prisma.glucoseDailySummary.findMany({ orderBy: { patientId: 'asc' } });
    expect(rows).toHaveLength(2);
    const mine = rows.find((r) => r.patientId === patientId)!;
    expect(mine.histogram[bin(100)]).toBe(1);
    expect(mine.histogram[bin(200)]).toBe(0);
  });

  it('does not overwrite a day the app already uploaded', async () => {
    await seed([['2026-10-10T15:00:00Z', 100]]);
    await prisma.glucoseDailySummary.create({
      data: {
        patientId,
        localDate: new Date('2026-10-10'),
        utcOffsetMinutes: -180,
        readingsCount: 2,
        coveredSlots: 2,
        histogram: Array.from({ length: HISTOGRAM_CONTRACT.bins }, (_, i) => (i === bin(150) ? 2 : 0)),
      },
    });

    await backfill();

    const [row] = await summaries();
    expect(row.readingsCount).toBe(2);
    expect(row.histogram[bin(150)]).toBe(2);
  });

  it('writes nothing when there are no readings', async () => {
    await backfill();
    expect(await summaries()).toEqual([]);
  });
});

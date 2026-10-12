import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';

/**
 * Runs the backfill section of the glucose-bucket migration over seeded
 * readings. The migration already ran on an empty table when the database was
 * built, so the SQL is lifted from the file and executed here, by itself.
 */
const migration = readFileSync(
  path.resolve(__dirname, '../../prisma/migrations/20261012120000_add_glucose_bucket/migration.sql'),
  'utf8',
);
const BACKFILL = migration.slice(migration.indexOf('-- BACKFILL') + '-- BACKFILL'.length);

let patientId: string;

beforeEach(async () => {
  await truncateAll();
  patientId = (await signedInPatient()).userId;
});

afterAll(async () => {
  await disconnect();
});

const seed = (rows: [string, number][], who = patientId) =>
  prisma.glucoseReading.createMany({
    data: rows.map(([at, valueMgDl]) => ({ patientId: who, recordedAt: new Date(at), valueMgDl })),
  });

const backfill = () => prisma.$executeRawUnsafe(BACKFILL);
const buckets = () => prisma.glucoseBucket.findMany({ orderBy: [{ patientId: 'asc' }, { bucketStart: 'asc' }] });

describe('glucose bucket backfill', () => {
  it('has a section to run', () => {
    expect(BACKFILL).toContain('INSERT INTO "GlucoseBucket"');
  });

  it('groups readings into 15-minute intervals aligned to UTC', async () => {
    await seed([
      ['2026-10-10T12:00:00Z', 100],
      ['2026-10-10T12:14:59Z', 110],
      ['2026-10-10T12:15:00Z', 120],
      ['2026-10-10T13:00:00Z', 130],
    ]);

    await backfill();

    const rows = await buckets();
    expect(rows.map((r) => r.bucketStart.toISOString())).toEqual([
      '2026-10-10T12:00:00.000Z',
      '2026-10-10T12:15:00.000Z',
      '2026-10-10T13:00:00.000Z',
    ]);
    expect(rows.map((r) => r.readingsCount)).toEqual([2, 1, 1]);
  });

  it('needs no time zone: the same readings give the same buckets', async () => {
    await seed([
      ['2026-10-10T02:59:00Z', 100], // 23:59 in Brasilia, still the 9th there
      ['2026-10-10T03:00:00Z', 110], // midnight in Brasilia
    ]);

    await backfill();

    expect((await buckets()).map((r) => r.bucketStart.toISOString())).toEqual([
      '2026-10-10T02:45:00.000Z',
      '2026-10-10T03:00:00.000Z',
    ]);
  });

  it('lists distinct values ascending with their counts, and clamps to the edges', async () => {
    await seed([
      ['2026-10-10T12:00:00Z', 150],
      ['2026-10-10T12:01:00Z', 100],
      ['2026-10-10T12:02:00Z', 150],
      ['2026-10-10T12:03:00Z', 100],
      ['2026-10-10T12:04:00Z', 150],
      ['2026-10-10T12:05:00Z', 30], // below 40
      ['2026-10-10T12:06:00Z', 700], // above 600
    ]);

    await backfill();

    const [row] = await buckets();
    expect(row.mgDl).toEqual([40, 100, 150, 600]);
    expect(row.counts).toEqual([1, 2, 3, 1]);
    expect(row.readingsCount).toBe(7);
  });

  it('counts 5-minute slots, not readings, as covered', async () => {
    await seed([
      ['2026-10-10T12:00:00Z', 100],
      ['2026-10-10T12:01:00Z', 101],
      ['2026-10-10T12:04:59Z', 102], // same slot as the two above
      ['2026-10-10T12:05:00Z', 103], // next slot
    ]);

    await backfill();

    const [row] = await buckets();
    expect(row.readingsCount).toBe(4);
    expect(row.coveredSlots).toBe(2);
  });

  it('keeps patients apart', async () => {
    const other = (await signedInPatient()).userId;
    await seed([['2026-10-10T12:00:00Z', 100]]);
    await seed([['2026-10-10T12:00:00Z', 200]], other);

    await backfill();

    const rows = await buckets();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.patientId === patientId)!.mgDl).toEqual([100]);
    expect(rows.find((r) => r.patientId === other)!.mgDl).toEqual([200]);
  });

  it('does not overwrite an interval the app already uploaded', async () => {
    await seed([['2026-10-10T12:00:00Z', 100]]);
    await prisma.glucoseBucket.create({
      data: {
        patientId,
        bucketStart: new Date('2026-10-10T12:00:00Z'),
        readingsCount: 15,
        coveredSlots: 3,
        mgDl: [150],
        counts: [15],
      },
    });

    await backfill();

    const [row] = await buckets();
    expect(row.readingsCount).toBe(15);
    expect(row.mgDl).toEqual([150]);
  });

  it('writes nothing when there are no readings', async () => {
    await backfill();
    expect(await buckets()).toEqual([]);
  });
});

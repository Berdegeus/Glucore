import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DateRange } from '../../src/modules/dashboard/dashboard.repository';
import { PrismaCohortRepository } from '../../src/modules/professional/professional.repository';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';

/**
 * Cohort hypo episodes by local start hour (PRO-10), against a real Postgres.
 * The episode is the sustained (>= 15 minutes) HYPO run of the patient summary.
 */

const repository = new PrismaCohortRepository(prisma);
const RANGE: DateRange = {
  from: new Date('2026-08-05T00:00:00.000Z'),
  toExclusive: new Date('2026-08-12T00:00:00.000Z'),
};

afterAll(async () => {
  await disconnect();
});

beforeEach(async () => {
  await truncateAll();
});

/** One reading per value, five minutes apart from `start`. */
async function seedReadings(patientId: string, start: string, values: number[]): Promise<void> {
  await prisma.glucoseReading.createMany({
    data: values.map((valueMgDl, i) => ({
      patientId,
      valueMgDl,
      recordedAt: new Date(Date.parse(start) + i * 5 * 60_000),
    })),
  });
}

const HYPO_15_MIN = [60, 60, 60, 60, 100];
const HYPO_10_MIN = [60, 60, 60, 100];

async function seedTwoPatients(): Promise<{ a: string; b: string; outsider: string }> {
  const a = (await signedInPatient()).userId;
  const b = (await signedInPatient()).userId;
  const outsider = (await signedInPatient()).userId;
  // a: starts 02:00 UTC (23h the day before in Sao Paulo), plus a 10-minute dip that is not an episode.
  await seedReadings(a, '2026-08-06T02:00:00.000Z', HYPO_15_MIN);
  await seedReadings(a, '2026-08-07T09:00:00.000Z', HYPO_10_MIN);
  // b: two episodes in the same UTC hour (14h UTC, 11h in Sao Paulo).
  await seedReadings(b, '2026-08-06T14:05:00.000Z', HYPO_15_MIN);
  await seedReadings(b, '2026-08-08T14:40:00.000Z', HYPO_15_MIN);
  await seedReadings(outsider, '2026-08-06T02:00:00.000Z', HYPO_15_MIN);
  return { a, b, outsider };
}

describe('getHypoStartHours', () => {
  it('counts the episodes of two patients at the local hour they started', async () => {
    const { a, b } = await seedTwoPatients();

    const saoPaulo = await repository.getHypoStartHours([a, b], RANGE, 'America/Sao_Paulo');
    const utc = await repository.getHypoStartHours([a, b], RANGE, 'UTC');

    expect(saoPaulo).toEqual([
      { hour: 11, count: 2 },
      { hour: 23, count: 1 },
    ]);
    expect(utc).toEqual([
      { hour: 2, count: 1 },
      { hour: 14, count: 2 },
    ]);
  });

  it('counts only the ids it was given, and nothing for an empty list', async () => {
    const { a } = await seedTwoPatients();

    expect(await repository.getHypoStartHours([a], RANGE, 'UTC')).toEqual([{ hour: 2, count: 1 }]);
    expect(await repository.getHypoStartHours([], RANGE, 'UTC')).toEqual([]);
  });

  it('ignores a run shorter than 15 minutes and keeps one of exactly 15', async () => {
    const patient = (await signedInPatient()).userId;
    await seedReadings(patient, '2026-08-06T05:00:00.000Z', HYPO_10_MIN);
    await seedReadings(patient, '2026-08-06T07:00:00.000Z', HYPO_15_MIN);

    expect(await repository.getHypoStartHours([patient], RANGE, 'UTC')).toEqual([{ hour: 7, count: 1 }]);
  });
});

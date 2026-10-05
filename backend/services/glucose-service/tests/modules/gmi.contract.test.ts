import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaDashboardRepository } from '../../src/modules/dashboard/dashboard.repository';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';

/**
 * Pins the GMI the database computes to `contracts/gmi-cases.json`, the table
 * the mobile app's report is tested against too (API-09). The two sides share
 * one formula, `3.31 + 0.02392 x mean`; a change on one side only has to fail
 * on that side's test, against the same cases.
 */

interface GmiCase {
  meanMgDl: number;
  gmi: number;
}

const CONTRACT_PATH = path.resolve(__dirname, '../../../../../contracts/gmi-cases.json');
const cases = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as GmiCase[];

const repository = new PrismaDashboardRepository(prisma);

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const RANGE = { from: day('2026-08-05'), toExclusive: day('2026-08-06') };
const round2 = (value: number) => Math.round(value * 100) / 100;

afterAll(async () => {
  await disconnect();
});

describe('contracts/gmi-cases.json', () => {
  it('covers the means 80, 120, 154, 183 and 250 mg/dL', () => {
    expect(cases.map((c) => c.meanMgDl)).toEqual([80, 120, 154, 183, 250]);
  });

  it('lists every expected GMI as 3.31 + 0.02392 x mean, to two decimals', () => {
    expect(cases.map((c) => c.gmi)).toEqual(cases.map((c) => round2(3.31 + 0.02392 * c.meanMgDl)));
  });
});

describe('glucose_metrics() GMI against the contract', () => {
  let patientId: string;

  beforeEach(async () => {
    await truncateAll();
    patientId = (await signedInPatient()).userId;
  });

  /** Two readings 15 mg/dL either side of the mean, so the mean is the case's and not just one reading. */
  async function seedWithMean(meanMgDl: number): Promise<void> {
    await prisma.glucoseReading.createMany({
      data: [meanMgDl - 15, meanMgDl + 15].map((valueMgDl, i) => ({
        patientId,
        valueMgDl,
        recordedAt: new Date(Date.parse('2026-08-05T08:00:00.000Z') + i * 5 * 60_000),
      })),
    });
  }

  it.each(cases)('mean $meanMgDl mg/dL gives GMI $gmi', async ({ meanMgDl, gmi }) => {
    await seedWithMean(meanMgDl);

    const metrics = await repository.getPeriodMetrics(patientId, RANGE, 80, 180);

    expect(metrics.avgGlucose).toBe(meanMgDl);
    expect(round2(metrics.gmiPercent as number)).toBe(gmi);
  });
});

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaDashboardRepository, type DateRange } from '../../src/modules/dashboard/dashboard.repository';
import { sensorUsePercent } from '../../src/modules/dashboard/dashboard.metrics';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { PrismaPatientRepository } from '../../src/modules/patient/patient.repository';
import { PrismaCohortRepository } from '../../src/modules/professional/professional.repository';
import { FakeTimeZoneChecker } from '../helpers/fakes';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';

/**
 * Portfolio metrics against a real Postgres: the numbers of each patient must
 * be the ones that patient's own dashboard summary shows (PRO-03), computed in
 * one query for the whole list (PRO-11).
 */

const summaries = new DashboardService(
  new PrismaDashboardRepository(prisma),
  new PrismaPatientRepository(prisma),
  new FakeTimeZoneChecker(),
);

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const FROM = day('2026-08-05');
const TO = day('2026-08-11');
const DAYS = 7;
const RANGE: DateRange = { from: FROM, toExclusive: day('2026-08-12') };

afterAll(async () => {
  await disconnect();
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

async function seedAlerts(patientId: string, instants: string[]): Promise<void> {
  await prisma.alertEvent.createMany({
    data: instants.map((at) => ({ patientId, alertType: 'HYPO_RISK' as const, triggeredAt: new Date(at) })),
  });
}

interface Cohort {
  defaults: string;
  empty: string;
  custom: string;
}

async function seedCohort(): Promise<Cohort> {
  const defaults = (await signedInPatient()).userId;
  const empty = (await signedInPatient()).userId;
  const custom = (await signedInPatient({ targetRangeMin: 70, targetRangeMax: 150 })).userId;

  // 80/180: a 15-minute hypo run (exactly the minimum), a 5-minute one (too short), and a later reading outside the period.
  await seedReadings(defaults, '2026-08-05T08:00:00.000Z', [60, 60, 60, 60, 100, 100, 200, 200, 200, 90]);
  await seedReadings(defaults, '2026-08-06T12:00:00.000Z', [60, 60, 100]);
  await seedReadings(defaults, '2026-08-20T09:30:00.000Z', [110]);
  await seedAlerts(defaults, ['2026-08-05T09:00:00.000Z', '2026-08-10T23:59:00.000Z', '2026-08-12T00:00:00.000Z']);

  // 70/150: 75 is a hypo for the default thresholds but not for this patient.
  await seedReadings(custom, '2026-08-07T08:00:00.000Z', [65, 65, 65, 65, 65, 75, 75, 160, 160, 100]);
  await seedAlerts(custom, ['2026-08-07T10:00:00.000Z']);
  return { defaults, empty, custom };
}

beforeEach(async () => {
  await truncateAll();
});

describe('getPatientMetrics', () => {
  it('gives each patient the metrics of that patient own dashboard summary', async () => {
    const { defaults, empty, custom } = await seedCohort();

    const rows = await new PrismaCohortRepository(prisma).getPatientMetrics([defaults, empty, custom], RANGE);

    expect(rows.map((row) => row.patientId).sort()).toEqual([defaults, empty, custom].sort());
    for (const patientId of [defaults, empty, custom]) {
      const summary = await summaries.getSummary(patientId, { from: FROM, to: TO, bucket: 'day', tz: 'UTC' });
      const row = rows.find((candidate) => candidate.patientId === patientId)!;
      expect(row).toEqual({
        patientId,
        lastReadingAt: summary.lastReadingAt,
        timeInRangePercent: summary.timeInRangePercent,
        gmiPercent: summary.gmiPercent,
        cvPercent: summary.coefficientOfVariationPercent,
        readingsCount: summary.totals.readingsCount,
        zoneDistribution: summary.zoneDistribution,
        hypoEpisodes: summary.excursions.filter((excursion) => excursion.kind === 'HYPO').length,
        alertsCount: summary.totals.alertsCount,
      });
      expect(sensorUsePercent(row.readingsCount, DAYS)).toBe(summary.sensorUsePercent);
    }
  });

  it('counts the sustained hypo runs and the alerts inside the period, per patient thresholds', async () => {
    const { defaults, custom } = await seedCohort();

    const rows = await new PrismaCohortRepository(prisma).getPatientMetrics([defaults, custom], RANGE);

    const byId = new Map(rows.map((row) => [row.patientId, row]));
    // defaults: the 15-minute run counts, the 5-minute one does not; the alert at 12 Aug 00:00 is outside.
    expect(byId.get(defaults)).toMatchObject({ hypoEpisodes: 1, alertsCount: 2 });
    // custom: 65 x5 is a 20-minute hypo at 70; the 75s are in range for 70/150.
    expect(byId.get(custom)).toMatchObject({ hypoEpisodes: 1, alertsCount: 1 });
  });

  it('keeps the last reading unbounded by the period', async () => {
    const { defaults } = await seedCohort();

    const [row] = await new PrismaCohortRepository(prisma).getPatientMetrics([defaults], RANGE);

    expect(row.lastReadingAt).toBe('2026-08-20T09:30:00.000Z');
  });

  it('answers a patient with no readings with null metrics and zero counts', async () => {
    const { empty } = await seedCohort();

    const [row] = await new PrismaCohortRepository(prisma).getPatientMetrics([empty], RANGE);

    expect(row).toEqual({
      patientId: empty,
      lastReadingAt: null,
      timeInRangePercent: null,
      gmiPercent: null,
      cvPercent: null,
      readingsCount: 0,
      zoneDistribution: { veryLow: 0, low: 0, target: 0, high: 0, veryHigh: 0 },
      hypoEpisodes: 0,
      alertsCount: 0,
    });
  });

  it('returns only the ids it was given', async () => {
    const { defaults, custom } = await seedCohort();

    const rows = await new PrismaCohortRepository(prisma).getPatientMetrics([custom], RANGE);

    expect(rows.map((row) => row.patientId)).toEqual([custom]);
    expect(rows.some((row) => row.patientId === defaults)).toBe(false);
  });

  it('runs one SQL statement however many patients it is asked about, and none for an empty list', async () => {
    const { defaults, empty, custom } = await seedCohort();
    const queryRaw = vi.fn((...args: Parameters<PrismaClient['$queryRaw']>) => prisma.$queryRaw(...args));
    const counted = new PrismaCohortRepository({ $queryRaw: queryRaw } as unknown as PrismaClient);

    await counted.getPatientMetrics([defaults, empty, custom], RANGE);
    expect(queryRaw).toHaveBeenCalledTimes(1);

    expect(await counted.getPatientMetrics([], RANGE)).toEqual([]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});

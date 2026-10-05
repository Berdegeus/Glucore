import type { GlucoseSummary } from '../features/patient-dashboard/domain/summary';

/**
 * A complete summary as `GET /dashboard/summary` answers it, with the values of
 * the backend route test. The wire shape and the domain object are the same
 * here, so one fixture serves MSW bodies and use-case fakes alike.
 */
export function summaryFixture(overrides: Partial<GlucoseSummary> = {}): GlucoseSummary {
  return {
    from: '2026-08-05',
    to: '2026-08-06',
    tz: 'UTC',
    lastReadingAt: '2026-08-06T08:05:00.000Z',
    totals: { readingsCount: 17, carbEntries: 3, insulinEntries: 3, alertsCount: 3 },
    timeInRangePercent: 23.53,
    gmiPercent: 6.9,
    coefficientOfVariationPercent: 41.2,
    sensorUsePercent: 2.95,
    zoneDistribution: { veryLow: 0, low: 29.41, target: 23.53, high: 47.06, veryHigh: 0 },
    byDay: [
      {
        day: '2026-08-05',
        avgGlucose: 150.5,
        minGlucose: 60,
        maxGlucose: 250,
        timeInRangePercent: 21.43,
        movingAvg7d: 150.5,
        readingsCount: 15,
        carbsGrams: 105,
        insulinUnits: 30,
      },
      {
        day: '2026-08-06',
        avgGlucose: null,
        minGlucose: null,
        maxGlucose: null,
        timeInRangePercent: null,
        movingAvg7d: null,
        readingsCount: 0,
        carbsGrams: 30,
        insulinUnits: 0,
      },
    ],
    agp: [
      { hour: 8, p5: 60, p25: 62.5, p50: 70, p75: 80, p95: 90, count: 8 },
      { hour: 9, p5: 165, p25: 225, p50: 250, p75: 250, p95: 250, count: 4 },
    ],
    heatmap: [
      { dayOfWeek: 3, hour: 8, avgGlucose: 75, count: 6 },
      { dayOfWeek: 4, hour: 8, avgGlucose: 142.5, count: 2 },
    ],
    insulinByType: [{ insulinType: 'RAPID', totalUnits: 30, count: 3, avgUnits: 10 }],
    alertsByType: [{ alertType: 'HIGH', count: 3 }],
    excursions: [
      {
        kind: 'HYPO',
        startedAt: '2026-08-05T08:00:00.000Z',
        endedAt: '2026-08-05T08:25:00.000Z',
        durationMin: 30,
        minGlucose: 55,
        maxGlucose: 65,
      },
    ],
    ...overrides,
  };
}

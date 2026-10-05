import type { CohortSummary, PatientPage, PatientRow } from '../features/professional/domain/cohort';

const ZONES = { veryLow: 0, low: 2, target: 78, high: 18, veryHigh: 2 };

/** A row of `GET /professional/patients` as the gateway answers it (names added). */
export function patientRowDto(overrides: Record<string, unknown> = {}) {
  return {
    patientId: 'p1',
    fullName: 'Ana Souza',
    initials: 'AS',
    lastReadingAt: '2026-08-06T08:05:00.000Z',
    timeInRangePercent: 78,
    gmiPercent: 6.9,
    cvPercent: 31.5,
    sensorUsePercent: 92.5,
    zoneDistribution: { ...ZONES },
    hypoEpisodes: 2,
    alertsCount: 5,
    ...overrides,
  };
}

export function patientPageDto(items: unknown[] = [patientRowDto()]) {
  return { items, page: 1, limit: 50, total: items.length };
}

/** `GET /professional/cohort/summary` as the gateway answers it. */
export function cohortDto(overrides: Record<string, unknown> = {}) {
  return {
    patientCount: 2,
    avgTimeInRangePercent: 64,
    avgGmiPercent: 7.2,
    patientsWithHypo: 1,
    patientsStale: 1,
    perPatient: [
      { patientId: 'p1', fullName: 'Ana Souza', initials: 'AS', timeInRangePercent: 78, cvPercent: 31.5, zoneDistribution: { ...ZONES } },
      { patientId: 'p2', fullName: null, initials: 'PB2', timeInRangePercent: null, cvPercent: null, zoneDistribution: { ...ZONES } },
    ],
    tirHistogram: [
      { bucket: 'lt50', count: 0 },
      { bucket: '50to70', count: 1 },
      { bucket: 'gte70', count: 1 },
    ],
    hypoByHour: [
      { hour: 3, count: 2 },
      { hour: 14, count: 1 },
    ],
    ...overrides,
  };
}

/** The domain row for `patientRowDto()`, for use-case and hook tests that do not go over HTTP. */
export function patientRowOf(overrides: Partial<PatientRow> = {}): PatientRow {
  return {
    patientId: 'p1',
    fullName: 'Ana Souza',
    initials: 'AS',
    displayName: 'Ana Souza',
    lastReadingAt: '2026-08-06T08:05:00.000Z',
    timeInRangePercent: 78,
    gmiPercent: 6.9,
    cvPercent: 31.5,
    sensorUsePercent: 92.5,
    zoneDistribution: { ...ZONES },
    hypoEpisodes: 2,
    alertsCount: 5,
    ...overrides,
  };
}

export function patientPageOf(items: PatientRow[] = [patientRowOf()]): PatientPage {
  return { items, page: 1, limit: 50, total: items.length };
}

/** The domain cohort summary for `cohortDto()`. */
export function cohortSummaryOf(overrides: Partial<CohortSummary> = {}): CohortSummary {
  const dto = cohortDto();
  const [first, second] = dto.perPatient;
  return {
    ...dto,
    perPatient: [
      { ...first, displayName: 'Ana Souza' },
      { ...second, displayName: 'PB2' },
    ],
    tirHistogram: dto.tirHistogram as CohortSummary['tirHistogram'],
    ...overrides,
  } as CohortSummary;
}

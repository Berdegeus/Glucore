import {
  mapZonesRow,
  toNullableNumber,
  toNumber,
  type RawZonesRow,
  type ZoneDistributionDto,
} from '../dashboard/dashboard.mapper';
import { sensorUsePercent } from '../dashboard/dashboard.metrics';

/** One patient's period metrics, as the portfolio queries return them (no name: the gateway adds it). */
export interface PatientMetrics {
  patientId: string;
  lastReadingAt: string | null;
  timeInRangePercent: number | null;
  gmiPercent: number | null;
  cvPercent: number | null;
  /** Readings inside the period; the service turns it into `sensorUsePercent`. */
  readingsCount: number;
  zoneDistribution: ZoneDistributionDto;
  hypoEpisodes: number;
  alertsCount: number;
}

/** Raw row from the portfolio metrics `$queryRaw`: `glucose_zones` columns plus the rest. */
export interface RawPatientMetricsRow extends RawZonesRow {
  patient_id: string;
  last_reading_at: unknown;
  tir_percent: unknown;
  gmi: unknown;
  cv: unknown;
  readings_count: unknown;
  hypo_episodes: unknown;
  alerts_count: unknown;
}

export function mapPatientMetricsRow(row: RawPatientMetricsRow): PatientMetrics {
  return {
    patientId: row.patient_id,
    lastReadingAt: row.last_reading_at === null ? null : (row.last_reading_at as Date).toISOString(),
    timeInRangePercent: toNullableNumber(row.tir_percent),
    gmiPercent: toNullableNumber(row.gmi),
    cvPercent: toNullableNumber(row.cv),
    readingsCount: toNumber(row.readings_count),
    zoneDistribution: mapZonesRow(row),
    hypoEpisodes: toNumber(row.hypo_episodes),
    alertsCount: toNumber(row.alerts_count),
  };
}

/** One row of the portfolio list. No name: the gateway adds `fullName` and `initials` (PRO-15). */
export interface PatientListItemDto {
  patientId: string;
  lastReadingAt: string | null;
  timeInRangePercent: number | null;
  gmiPercent: number | null;
  cvPercent: number | null;
  sensorUsePercent: number;
  zoneDistribution: ZoneDistributionDto;
  hypoEpisodes: number;
  alertsCount: number;
}

export interface PatientListDto {
  items: PatientListItemDto[];
  page: number;
  limit: number;
  total: number;
}

export function toPatientListItem(metrics: PatientMetrics, days: number): PatientListItemDto {
  return {
    patientId: metrics.patientId,
    lastReadingAt: metrics.lastReadingAt,
    timeInRangePercent: metrics.timeInRangePercent,
    gmiPercent: metrics.gmiPercent,
    cvPercent: metrics.cvPercent,
    sensorUsePercent: sensorUsePercent(metrics.readingsCount, days),
    zoneDistribution: metrics.zoneDistribution,
    hypoEpisodes: metrics.hypoEpisodes,
    alertsCount: metrics.alertsCount,
  };
}

export type TirBucket = 'lt50' | '50to70' | 'gte70';

export interface CohortPatientDto {
  patientId: string;
  timeInRangePercent: number | null;
  cvPercent: number | null;
  zoneDistribution: ZoneDistributionDto;
}

export interface CohortSummaryDto {
  patientCount: number;
  avgTimeInRangePercent: number | null;
  avgGmiPercent: number | null;
  patientsWithHypo: number;
  patientsStale: number;
  perPatient: CohortPatientDto[];
  tirHistogram: Array<{ bucket: TirBucket; count: number }>;
  hypoByHour: Array<{ hour: number; count: number }>;
}

const TIR_BUCKETS: readonly TirBucket[] = ['lt50', '50to70', 'gte70'];

/** `<50`, `50..<70`, `>=70`: the boundary value belongs to the higher bucket. */
export function tirBucket(timeInRangePercent: number): TirBucket {
  if (timeInRangePercent < 50) return 'lt50';
  if (timeInRangePercent < 70) return '50to70';
  return 'gte70';
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** No reading in the last 24 hours, or none ever. Exactly 24 hours ago is still "recent". */
export function isStale(lastReadingAt: string | null, now: Date): boolean {
  if (lastReadingAt === null) return true;
  return now.getTime() - Date.parse(lastReadingAt) > STALE_AFTER_MS;
}

/** Mean over the non-null values, to two decimals; `null` when there is none (a mean of nothing is not 0). */
export function meanOrNull(values: ReadonlyArray<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  return Math.round(mean * 100) / 100;
}

/**
 * The cohort numbers from the per-patient metrics the repository computed.
 * Arrays always have their full shape (three buckets, 24 hours), so an empty
 * cohort and a full one draw the same charts.
 */
export function buildCohortSummary(
  metrics: readonly PatientMetrics[],
  hypoHours: ReadonlyArray<{ hour: number; count: number }>,
  now: Date,
): CohortSummaryDto {
  const histogram = new Map<TirBucket, number>(TIR_BUCKETS.map((bucket) => [bucket, 0]));
  for (const { timeInRangePercent } of metrics) {
    if (timeInRangePercent === null) continue;
    const bucket = tirBucket(timeInRangePercent);
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  }
  const hypoCountByHour = new Map(hypoHours.map(({ hour, count }) => [hour, count]));

  return {
    patientCount: metrics.length,
    avgTimeInRangePercent: meanOrNull(metrics.map((row) => row.timeInRangePercent)),
    avgGmiPercent: meanOrNull(metrics.map((row) => row.gmiPercent)),
    patientsWithHypo: metrics.filter((row) => row.hypoEpisodes > 0).length,
    patientsStale: metrics.filter((row) => isStale(row.lastReadingAt, now)).length,
    perPatient: metrics.map((row) => ({
      patientId: row.patientId,
      timeInRangePercent: row.timeInRangePercent,
      cvPercent: row.cvPercent,
      zoneDistribution: row.zoneDistribution,
    })),
    tirHistogram: TIR_BUCKETS.map((bucket) => ({ bucket, count: histogram.get(bucket) ?? 0 })),
    hypoByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hypoCountByHour.get(hour) ?? 0 })),
  };
}

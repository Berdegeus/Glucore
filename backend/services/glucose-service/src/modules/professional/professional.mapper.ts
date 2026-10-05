import {
  mapZonesRow,
  toNullableNumber,
  toNumber,
  type RawZonesRow,
  type ZoneDistributionDto,
} from '../dashboard/dashboard.mapper';

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

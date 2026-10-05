/**
 * Coercion boundary for every number that came back through `$queryRaw` or a
 * Prisma `groupBy` aggregate.
 *
 * `COUNT(*)` answers as a JS `bigint`, `NUMERIC`/`DECIMAL` columns answer as
 * `Prisma.Decimal` (raw queries) or a numeric string (some drivers) — none of
 * those survive `JSON.stringify` un-touched, and a `bigint` throws outright
 * ("Do not know how to serialize a BigInt"). Every field this module hands to
 * a controller must have passed through `toNumber` first.
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export interface DashboardTotals {
  readingsCount: number;
  carbEntries: number;
  insulinEntries: number;
  alertsCount: number;
}

export interface InsulinByTypeDto {
  insulinType: string;
  totalUnits: number;
  count: number;
  avgUnits: number;
}

export interface AlertsByTypeDto {
  alertType: string;
  count: number;
}

export interface PeriodMetricsDto {
  avgGlucose: number | null;
  gmiPercent: number | null;
  cvPercent: number | null;
  timeInRangePercent: number | null;
  readingsCount: number;
}

/** Share of readings in each CGM zone, in percent; the five add up to 100 (0 each with no readings). */
export interface ZoneDistributionDto {
  veryLow: number;
  low: number;
  target: number;
  high: number;
  veryHigh: number;
}

/** Raw row shape from the `glucose_zones()` stored function via `$queryRaw`. */
export interface RawZonesRow {
  very_low_percent: unknown;
  low_percent: unknown;
  target_percent: unknown;
  high_percent: unknown;
  very_high_percent: unknown;
}

/**
 * The function answers NULL percents for a period with no readings; the
 * contract is a number per zone, so they become 0 here (`toNumber`).
 */
export function mapZonesRow(row: RawZonesRow | undefined): ZoneDistributionDto {
  return {
    veryLow: toNumber(row?.very_low_percent),
    low: toNumber(row?.low_percent),
    target: toNumber(row?.target_percent),
    high: toNumber(row?.high_percent),
    veryHigh: toNumber(row?.very_high_percent),
  };
}

/** Percentiles of the glucose readings taken at one local hour of the day (the AGP curve). */
export interface AgpPointDto {
  hour: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  count: number;
}

/** Raw row shape from the AGP `$queryRaw`: the five percentiles arrive together, as a `float8[]`. */
export interface RawAgpRow {
  hour: unknown;
  percentiles: unknown[];
  readings_count: unknown;
}

const roundTo2 = (value: unknown): number => Math.round(toNumber(value) * 100) / 100;

/** Percentiles come back as raw doubles (`100.80000000000001`); two decimals is plenty for mg/dL. */
export function mapAgpRow(row: RawAgpRow): AgpPointDto {
  const [p5, p25, p50, p75, p95] = row.percentiles.map(roundTo2);
  return { hour: toNumber(row.hour), p5, p25, p50, p75, p95, count: toNumber(row.readings_count) };
}

export interface DailyBucketDto {
  day: string;
  avgGlucose: number | null;
  minGlucose: number | null;
  maxGlucose: number | null;
  timeInRangePercent: number | null;
  movingAvg7d: number | null;
  readingsCount: number;
}

export interface ExcursionDto {
  kind: 'HYPO' | 'HYPER';
  startedAt: string;
  endedAt: string;
  durationMin: number;
  minGlucose: number;
  maxGlucose: number;
}

export interface DashboardSummaryDto {
  from: string;
  to: string;
  totals: DashboardTotals;
  timeInRangePercent: number | null;
  gmiPercent: number | null;
  coefficientOfVariationPercent: number | null;
  byDay: DailyBucketDto[];
  insulinByType: InsulinByTypeDto[];
  alertsByType: AlertsByTypeDto[];
  excursions: ExcursionDto[];
}

/** Raw row shape from the `glucose_metrics()` stored procedure via `$queryRaw`. */
export interface RawPeriodMetricsRow {
  avg_glucose: unknown;
  gmi: unknown;
  cv: unknown;
  tir_percent: unknown;
  readings_count: unknown;
}

export function mapPeriodMetricsRow(row: RawPeriodMetricsRow | undefined): PeriodMetricsDto {
  if (!row) {
    return { avgGlucose: null, gmiPercent: null, cvPercent: null, timeInRangePercent: null, readingsCount: 0 };
  }
  return {
    avgGlucose: toNullableNumber(row.avg_glucose),
    gmiPercent: toNullableNumber(row.gmi),
    cvPercent: toNullableNumber(row.cv),
    timeInRangePercent: toNullableNumber(row.tir_percent),
    readingsCount: toNumber(row.readings_count),
  };
}

/** Raw row shape from the daily-bucket `$queryRaw` (Q1). */
export interface RawDailyBucketRow {
  day: unknown;
  avg_glucose: unknown;
  min_glucose: unknown;
  max_glucose: unknown;
  readings_count: unknown;
  time_in_range_percent: unknown;
  moving_avg_7d: unknown;
}

export function mapDailyBucketRow(row: RawDailyBucketRow): DailyBucketDto {
  return {
    day: (row.day as Date).toISOString().slice(0, 10),
    avgGlucose: toNullableNumber(row.avg_glucose),
    minGlucose: toNullableNumber(row.min_glucose),
    maxGlucose: toNullableNumber(row.max_glucose),
    timeInRangePercent: toNullableNumber(row.time_in_range_percent),
    movingAvg7d: toNullableNumber(row.moving_avg_7d),
    readingsCount: toNumber(row.readings_count),
  };
}

/** Raw row shape from the excursions `$queryRaw` (Q2, gaps-and-islands). */
export interface RawExcursionRow {
  kind: unknown;
  started_at: unknown;
  ended_at: unknown;
  duration_min: unknown;
  min_glucose: unknown;
  max_glucose: unknown;
}

export function mapExcursionRow(row: RawExcursionRow): ExcursionDto {
  return {
    kind: row.kind as 'HYPO' | 'HYPER',
    startedAt: (row.started_at as Date).toISOString(),
    endedAt: (row.ended_at as Date).toISOString(),
    durationMin: toNumber(row.duration_min),
    minGlucose: toNumber(row.min_glucose),
    maxGlucose: toNumber(row.max_glucose),
  };
}

/** Raw row shape from `insulinEvent.groupBy` (Prisma aggregates, e.g. `Prisma.Decimal`). */
export interface RawInsulinByTypeRow {
  insulinType: string;
  _sum: { doseUnits: unknown };
  _avg: { doseUnits: unknown };
  _count: number;
}

export function mapInsulinByTypeRow(row: RawInsulinByTypeRow): InsulinByTypeDto {
  return {
    insulinType: row.insulinType,
    totalUnits: toNumber(row._sum.doseUnits),
    avgUnits: toNumber(row._avg.doseUnits),
    count: row._count,
  };
}

/** Raw row shape from `alertEvent.groupBy`. */
export interface RawAlertsByTypeRow {
  alertType: string;
  _count: number;
}

export function mapAlertsByTypeRow(row: RawAlertsByTypeRow): AlertsByTypeDto {
  return { alertType: row.alertType, count: row._count };
}

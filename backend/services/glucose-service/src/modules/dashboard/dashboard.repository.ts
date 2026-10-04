import type { PrismaClient } from '@prisma/client';

import {
  mapAlertsByTypeRow,
  mapDailyBucketRow,
  mapExcursionRow,
  mapInsulinByTypeRow,
  mapPeriodMetricsRow,
  type AlertsByTypeDto,
  type DailyBucketDto,
  type DashboardTotals,
  type ExcursionDto,
  type InsulinByTypeDto,
  type PeriodMetricsDto,
  type RawAlertsByTypeRow,
  type RawDailyBucketRow,
  type RawExcursionRow,
  type RawInsulinByTypeRow,
  type RawPeriodMetricsRow,
} from './dashboard.mapper';

/** A closed-open range: `[from, toExclusive)`. Callers add a day to an inclusive calendar "to". */
export interface DateRange {
  from: Date;
  toExclusive: Date;
}

export interface IDashboardRepository {
  /** The patient's configured thresholds, if any — `AlertThresholdConfig` is an optional relation. */
  getThresholdConfig(
    patientId: string,
  ): Promise<{ lowGlucoseMgDl: number; highGlucoseMgDl: number } | null>;
  /** Plain counts — no aggregation technique needed here, just the WHERE the rest of the module shares. */
  getTotals(patientId: string, range: DateRange): Promise<DashboardTotals>;
  /** Prisma `groupBy` (a). */
  getInsulinByType(patientId: string, range: DateRange): Promise<InsulinByTypeDto[]>;
  /** Prisma `groupBy` (a). */
  getAlertsByType(patientId: string, range: DateRange): Promise<AlertsByTypeDto[]>;
  /** `glucose_metrics()` stored procedure (c) — GMI/CV/TIR for the whole period. */
  getPeriodMetrics(patientId: string, range: DateRange, low: number, high: number): Promise<PeriodMetricsDto>;
  /** SQL cru, Q1 (b) — `date_trunc` + 7-day moving average window function. */
  getDailyBuckets(patientId: string, range: DateRange, low: number, high: number): Promise<DailyBucketDto[]>;
  /** SQL cru, Q2 (b) — gaps-and-islands over sustained hypo/hyper readings. */
  getExcursions(patientId: string, range: DateRange, low: number, high: number): Promise<ExcursionDto[]>;
}

export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getThresholdConfig(
    patientId: string,
  ): Promise<{ lowGlucoseMgDl: number; highGlucoseMgDl: number } | null> {
    const config = await this.prisma.alertThresholdConfig.findUnique({ where: { patientId } });
    if (!config) return null;
    return { lowGlucoseMgDl: config.lowGlucoseMgDl, highGlucoseMgDl: config.highGlucoseMgDl };
  }

  async getTotals(patientId: string, { from, toExclusive }: DateRange): Promise<DashboardTotals> {
    const [readingsCount, carbEntries, insulinEntries, alertsCount] = await Promise.all([
      this.prisma.glucoseReading.count({
        where: { patientId, recordedAt: { gte: from, lt: toExclusive } },
      }),
      this.prisma.carbEvent.count({ where: { patientId, eventAt: { gte: from, lt: toExclusive } } }),
      this.prisma.insulinEvent.count({ where: { patientId, eventAt: { gte: from, lt: toExclusive } } }),
      this.prisma.alertEvent.count({
        where: { patientId, triggeredAt: { gte: from, lt: toExclusive } },
      }),
    ]);
    return { readingsCount, carbEntries, insulinEntries, alertsCount };
  }

  async getInsulinByType(patientId: string, { from, toExclusive }: DateRange): Promise<InsulinByTypeDto[]> {
    const rows = await this.prisma.insulinEvent.groupBy({
      by: ['insulinType'],
      where: { patientId, eventAt: { gte: from, lt: toExclusive } },
      _sum: { doseUnits: true },
      _avg: { doseUnits: true },
      _count: true,
    });
    return rows.map((row) => mapInsulinByTypeRow(row as unknown as RawInsulinByTypeRow));
  }

  async getAlertsByType(patientId: string, { from, toExclusive }: DateRange): Promise<AlertsByTypeDto[]> {
    const rows = await this.prisma.alertEvent.groupBy({
      by: ['alertType'],
      where: { patientId, triggeredAt: { gte: from, lt: toExclusive } },
      _count: true,
    });
    return rows.map((row) => mapAlertsByTypeRow(row as unknown as RawAlertsByTypeRow));
  }

  async getPeriodMetrics(
    patientId: string,
    { from, toExclusive }: DateRange,
    low: number,
    high: number,
  ): Promise<PeriodMetricsDto> {
    // `recordedAt` is a naive `timestamp` (UTC by convention, no tz column) but
    // Prisma always binds a JS `Date` raw-query parameter as `timestamptz`.
    // Comparing the two directly — or a bare `::timestamp` cast — would run the
    // comparison through the session's `TimeZone` (America/Sao_Paulo locally,
    // never UTC), shifting the boundary by that offset. `AT TIME ZONE 'UTC'`
    // reads the wall-clock digits in UTC regardless of session settings, which
    // is the one way to make this match what the ORM write path stored.
    const rows = await this.prisma.$queryRaw<RawPeriodMetricsRow[]>`
      SELECT * FROM glucose_metrics(
        ${patientId}::uuid,
        ${from} AT TIME ZONE 'UTC',
        ${toExclusive} AT TIME ZONE 'UTC',
        ${low}::integer,
        ${high}::integer
      )
    `;
    return mapPeriodMetricsRow(rows[0]);
  }

  async getDailyBuckets(
    patientId: string,
    { from, toExclusive }: DateRange,
    low: number,
    high: number,
  ): Promise<DailyBucketDto[]> {
    const rows = await this.prisma.$queryRaw<RawDailyBucketRow[]>`
      WITH days AS (
        SELECT
          date_trunc('day', "recordedAt") AS day,
          AVG("valueMgDl") AS avg_glucose,
          MIN("valueMgDl") AS min_glucose,
          MAX("valueMgDl") AS max_glucose,
          COUNT(*) AS readings_count,
          COUNT(*) FILTER (WHERE "valueMgDl" BETWEEN ${low}::integer AND ${high}::integer) AS in_range_count
        FROM "GlucoseReading"
        WHERE "patientId" = ${patientId}::uuid
          AND "recordedAt" >= (${from} AT TIME ZONE 'UTC')
          AND "recordedAt" < (${toExclusive} AT TIME ZONE 'UTC')
        GROUP BY 1
      )
      SELECT
        day,
        avg_glucose,
        min_glucose,
        max_glucose,
        readings_count,
        CASE WHEN readings_count > 0
          THEN ROUND(100.0 * in_range_count / readings_count, 2)
          ELSE NULL
        END AS time_in_range_percent,
        AVG(avg_glucose) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg_7d
      FROM days
      ORDER BY day
    `;
    return rows.map(mapDailyBucketRow);
  }

  async getExcursions(
    patientId: string,
    { from, toExclusive }: DateRange,
    low: number,
    high: number,
  ): Promise<ExcursionDto[]> {
    const rows = await this.prisma.$queryRaw<RawExcursionRow[]>`
      WITH classified AS (
        SELECT
          "recordedAt",
          "valueMgDl",
          CASE
            WHEN "valueMgDl" < ${low}::integer THEN 'HYPO'
            WHEN "valueMgDl" > ${high}::integer THEN 'HYPER'
            ELSE 'IN_RANGE'
          END AS kind
        FROM "GlucoseReading"
        WHERE "patientId" = ${patientId}::uuid
          AND "recordedAt" >= (${from} AT TIME ZONE 'UTC')
          AND "recordedAt" < (${toExclusive} AT TIME ZONE 'UTC')
      ),
      flagged AS (
        SELECT
          *,
          CASE WHEN kind IS DISTINCT FROM LAG(kind) OVER (ORDER BY "recordedAt") THEN 1 ELSE 0 END AS is_new_group
        FROM classified
      ),
      grouped AS (
        SELECT *, SUM(is_new_group) OVER (ORDER BY "recordedAt") AS group_id
        FROM flagged
      )
      SELECT
        kind,
        MIN("recordedAt") AS started_at,
        MAX("recordedAt") AS ended_at,
        EXTRACT(EPOCH FROM (MAX("recordedAt") - MIN("recordedAt"))) / 60.0 AS duration_min,
        MIN("valueMgDl") AS min_glucose,
        MAX("valueMgDl") AS max_glucose
      FROM grouped
      WHERE kind <> 'IN_RANGE'
      GROUP BY kind, group_id
      HAVING EXTRACT(EPOCH FROM (MAX("recordedAt") - MIN("recordedAt"))) / 60.0 >= 15
      ORDER BY started_at
    `;
    return rows.map(mapExcursionRow);
  }
}

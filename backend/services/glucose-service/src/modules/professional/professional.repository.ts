import type { PrismaClient } from '@prisma/client';

import type { DateRange } from '../dashboard/dashboard.repository';
import { mapPatientMetricsRow, type PatientMetrics, type RawPatientMetricsRow } from './professional.mapper';
import { cohortCtes } from './professional.sql';

/**
 * Portfolio reads: everything is computed in the database for a whole list of
 * patients at once (PRO-11). The caller passes only ids it already restricted to
 * the token's active grants; nothing here checks consent.
 */
export interface ICohortRepository {
  /**
   * Period metrics for every id in one query: `glucose_metrics` and `glucose_zones`
   * through `LATERAL`, plus hypo episodes, alerts and the last reading. The result
   * is unordered; an id with no readings still answers (null metrics, zero counts).
   */
  getPatientMetrics(ids: readonly string[], range: DateRange): Promise<PatientMetrics[]>;
}

export class PrismaCohortRepository implements ICohortRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPatientMetrics(ids: readonly string[], range: DateRange): Promise<PatientMetrics[]> {
    if (ids.length === 0) return [];

    const { from, toExclusive } = range;
    const rows = await this.prisma.$queryRaw<RawPatientMetricsRow[]>`
      WITH ${cohortCtes(ids, range)},
      hypo_counts AS (
        SELECT patient_id, COUNT(*) AS episodes FROM hypo_episodes GROUP BY patient_id
      )
      SELECT
        t.patient_id,
        lr.last_reading_at,
        m.tir_percent,
        m.gmi,
        m.cv,
        m.readings_count,
        z.very_low_percent,
        z.low_percent,
        z.target_percent,
        z.high_percent,
        z.very_high_percent,
        COALESCE(h.episodes, 0) AS hypo_episodes,
        al.alerts_count
      FROM thresholds t
      CROSS JOIN LATERAL glucose_metrics(
        t.patient_id,
        ${from} AT TIME ZONE 'UTC',
        ${toExclusive} AT TIME ZONE 'UTC',
        t.low::integer,
        t.high::integer
      ) AS m
      CROSS JOIN LATERAL glucose_zones(
        t.patient_id,
        ${from} AT TIME ZONE 'UTC',
        ${toExclusive} AT TIME ZONE 'UTC',
        t.low::integer,
        t.high::integer
      ) AS z
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS alerts_count
        FROM "AlertEvent" a
        WHERE a."patientId" = t.patient_id
          AND a."triggeredAt" >= (${from} AT TIME ZONE 'UTC')
          AND a."triggeredAt" < (${toExclusive} AT TIME ZONE 'UTC')
      ) AS al
      CROSS JOIN LATERAL (
        SELECT MAX("recordedAt") AS last_reading_at
        FROM "GlucoseReading"
        WHERE "patientId" = t.patient_id
      ) AS lr
      LEFT JOIN hypo_counts h ON h.patient_id = t.patient_id
    `;
    return rows.map(mapPatientMetricsRow);
  }
}


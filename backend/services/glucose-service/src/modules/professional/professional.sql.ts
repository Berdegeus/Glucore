import { Prisma } from '@prisma/client';

import type { DateRange } from '../dashboard/dashboard.repository';

/**
 * The CTEs the portfolio queries share: each patient's thresholds, and the
 * sustained hypo episodes of all of them in one pass.
 *
 * `thresholds` mirrors `DashboardService.resolveThresholds` row by row: the
 * patient's `AlertThresholdConfig`, else the `Patient` target range, else 80/180.
 * The episode definition mirrors `getExcursions` in the dashboard repository
 * (gaps-and-islands over HYPO/HYPER/IN_RANGE, a run kept only when it spans at
 * least 15 minutes), now partitioned by patient, so the portfolio and the
 * single-patient `excursions` always agree on what an episode is.
 *
 * Range bounds carry `AT TIME ZONE 'UTC'` for the reason documented on
 * `PrismaDashboardRepository.getPeriodMetrics`.
 */
export function cohortCtes(ids: readonly string[], { from, toExclusive }: DateRange): Prisma.Sql {
  return Prisma.sql`
    thresholds AS (
      SELECT
        i.id AS patient_id,
        COALESCE(c."lowGlucoseMgDl", p."targetRangeMin", 80) AS low,
        COALESCE(c."highGlucoseMgDl", p."targetRangeMax", 180) AS high
      FROM unnest(${ids as string[]}::uuid[]) AS i(id)
      LEFT JOIN "Patient" p ON p."userId" = i.id
      LEFT JOIN "AlertThresholdConfig" c ON c."patientId" = i.id
    ),
    classified AS (
      SELECT
        r."patientId" AS patient_id,
        r."recordedAt",
        CASE
          WHEN r."valueMgDl" < t.low THEN 'HYPO'
          WHEN r."valueMgDl" > t.high THEN 'HYPER'
          ELSE 'IN_RANGE'
        END AS kind
      FROM "GlucoseReading" r
      JOIN thresholds t ON t.patient_id = r."patientId"
      WHERE r."recordedAt" >= (${from} AT TIME ZONE 'UTC')
        AND r."recordedAt" < (${toExclusive} AT TIME ZONE 'UTC')
    ),
    flagged AS (
      SELECT
        *,
        CASE
          WHEN kind IS DISTINCT FROM LAG(kind) OVER (PARTITION BY patient_id ORDER BY "recordedAt")
          THEN 1 ELSE 0
        END AS is_new_group
      FROM classified
    ),
    grouped AS (
      SELECT *, SUM(is_new_group) OVER (PARTITION BY patient_id ORDER BY "recordedAt") AS group_id
      FROM flagged
    ),
    hypo_episodes AS (
      SELECT patient_id, MIN("recordedAt") AS started_at
      FROM grouped
      WHERE kind = 'HYPO'
      GROUP BY patient_id, group_id
      HAVING EXTRACT(EPOCH FROM (MAX("recordedAt") - MIN("recordedAt"))) / 60.0 >= 15
    )
  `;
}

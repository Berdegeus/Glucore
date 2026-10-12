-- The dashboard's TIR, GMI, CV, zones and per-day figures now come from the
-- daily summaries (migration 20261012120000) wherever one exists, and from the
-- readings everywhere else. Every figure is derived from the same relation,
-- `glucose_day_counts`: (local day, mg/dL, how many readings), so a day read
-- from a summary and a day read from the series are indistinguishable to what
-- sits on top.
--
-- Hand-written, like the migrations that created the functions this replaces
-- (20260831232506 and 20261004120000): Prisma cannot express stored functions.
-- `migrate dev --create-only` also proposes dropping
-- "GlucoseReading_patientId_recordedAt_desc_idx"; that DROP is not here on purpose.

-- A summary is only usable when the day was cut in the same offset the caller
-- asks for. The offset is read at local noon, which is also what the app sends
-- (contracts/glucose-histogram.json): a daylight-saving change never lands on it.
CREATE FUNCTION glucose_local_offset_minutes(p_day date, p_tz text) RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT (EXTRACT(EPOCH FROM (
    (p_day + time '12:00') - (((p_day + time '12:00') AT TIME ZONE p_tz) AT TIME ZONE 'UTC')
  )) / 60)::integer
$$;

-- The summaries that can stand in for the series over [p_from, p_to): the day
-- lies wholly inside the range (a day cut by the range falls back to the
-- readings) and was cut in the offset of p_tz.
CREATE FUNCTION glucose_usable_summaries(
  p_patient_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_tz text
)
RETURNS TABLE (local_day date, readings_count integer, covered_slots integer, histogram integer[])
LANGUAGE sql STABLE
AS $$
  SELECT s."localDate", s."readingsCount", s."coveredSlots", s."histogram"
  FROM "GlucoseDailySummary" s
  WHERE s."patientId" = p_patient_id
    AND ((s."localDate"::timestamp AT TIME ZONE p_tz) AT TIME ZONE 'UTC') >= p_from
    AND (((s."localDate" + 1)::timestamp AT TIME ZONE p_tz) AT TIME ZONE 'UTC') <= p_to
    AND s."utcOffsetMinutes" = glucose_local_offset_minutes(s."localDate", p_tz)
$$;

-- (local day, mg/dL, readings) over [p_from, p_to), sparse: only values that
-- occur. Histogram index 1 is 40 mg/dL, so ordinality n is 39 + n.
CREATE FUNCTION glucose_day_counts(
  p_patient_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_tz text
)
RETURNS TABLE (local_day date, mg_dl integer, cnt bigint)
LANGUAGE sql STABLE
AS $$
  WITH usable AS MATERIALIZED (
    SELECT * FROM glucose_usable_summaries(p_patient_id, p_from, p_to, p_tz)
  )
  SELECT u.local_day, (39 + h.ord)::integer, h.cnt::bigint
  FROM usable u
  CROSS JOIN LATERAL unnest(u.histogram) WITH ORDINALITY AS h(cnt, ord)
  WHERE h.cnt > 0
  UNION ALL
  SELECT r.local_day, r."valueMgDl", COUNT(*)
  FROM (
    SELECT
      (("recordedAt" AT TIME ZONE 'UTC') AT TIME ZONE p_tz)::date AS local_day,
      "valueMgDl"
    FROM "GlucoseReading"
    WHERE "patientId" = p_patient_id
      AND "recordedAt" >= p_from
      AND "recordedAt" < p_to
  ) AS r
  LEFT JOIN usable u ON u.local_day = r.local_day
  WHERE u.local_day IS NULL
  GROUP BY r.local_day, r."valueMgDl"
$$;

-- 5-minute slots with at least one reading: what "the sensor was reporting"
-- means whatever the sensor's own cadence, and what sensor use is measured in.
CREATE FUNCTION glucose_covered_slots(
  p_patient_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_tz text
)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  WITH usable AS MATERIALIZED (
    SELECT * FROM glucose_usable_summaries(p_patient_id, p_from, p_to, p_tz)
  )
  SELECT
    COALESCE((SELECT SUM(covered_slots) FROM usable), 0)
    + (
      SELECT COUNT(*) FROM (
        SELECT DISTINCT floor(extract(epoch FROM r."recordedAt") / 300)
        FROM "GlucoseReading" r
        LEFT JOIN usable u
          ON u.local_day = (((r."recordedAt" AT TIME ZONE 'UTC') AT TIME ZONE p_tz)::date)
        WHERE r."patientId" = p_patient_id
          AND r."recordedAt" >= p_from
          AND r."recordedAt" < p_to
          AND u.local_day IS NULL
      ) AS slots
    )
$$;

-- The signature changes (a time zone in, `covered_slots` out), so the old
-- functions go.
DROP FUNCTION glucose_metrics(uuid, timestamp, timestamp, integer, integer);
DROP FUNCTION glucose_zones(uuid, timestamp, timestamp, integer, integer);

-- GMI, CV and TIR for the period. Mean and sample standard deviation come from
-- exact sums over the counts (n, sum x, sum x^2 in numeric), so they equal what
-- AVG and STDDEV_SAMP gave over the rows. `readings_count` counts the readings
-- the sensor produced (a summary counts the minute series, not its thinning).
CREATE FUNCTION glucose_metrics(
  p_patient_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_low integer,
  p_high integer,
  p_tz text
)
RETURNS TABLE (
  avg_glucose numeric,
  gmi numeric,
  cv numeric,
  tir_percent numeric,
  readings_count bigint,
  covered_slots bigint
)
LANGUAGE sql STABLE
AS $$
  WITH c AS (
    SELECT mg_dl, SUM(cnt)::bigint AS cnt
    FROM glucose_day_counts(p_patient_id, p_from, p_to, p_tz)
    GROUP BY mg_dl
  ),
  t AS (
    SELECT
      COALESCE(SUM(cnt), 0)::bigint AS n,
      SUM(cnt * mg_dl)::numeric AS sx,
      SUM(cnt::numeric * mg_dl * mg_dl) AS sxx,
      COALESCE(SUM(cnt) FILTER (WHERE mg_dl BETWEEN p_low AND p_high), 0)::bigint AS in_range
    FROM c
  )
  SELECT
    t.sx / NULLIF(t.n, 0) AS avg_glucose,
    3.31 + 0.02392 * (t.sx / NULLIF(t.n, 0)) AS gmi,
    CASE WHEN t.n > 1 AND t.sx > 0
      THEN 100.0 * sqrt((t.n * t.sxx - t.sx * t.sx) / (t.n::numeric * (t.n - 1))) / (t.sx / t.n)
      ELSE NULL
    END AS cv,
    CASE WHEN t.n > 0 THEN ROUND(100.0 * t.in_range / t.n, 2) ELSE NULL END AS tir_percent,
    t.n AS readings_count,
    glucose_covered_slots(p_patient_id, p_from, p_to, p_tz) AS covered_slots
  FROM t
$$;

-- The five CGM zones as percentages, apportioned by the largest-remainder
-- method (see 20261004120000). Only the source of the counts changed.
CREATE FUNCTION glucose_zones(
  p_patient_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_low integer,
  p_high integer,
  p_tz text
)
RETURNS TABLE (
  very_low_percent numeric,
  low_percent numeric,
  target_percent numeric,
  high_percent numeric,
  very_high_percent numeric,
  readings_count bigint
)
LANGUAGE sql STABLE
AS $$
  WITH classified AS (
    SELECT
      CASE
        WHEN mg_dl < LEAST(54, p_low) THEN 1
        WHEN mg_dl < p_low THEN 2
        WHEN mg_dl <= p_high THEN 3
        WHEN mg_dl <= GREATEST(250, p_high) THEN 4
        ELSE 5
      END AS zone,
      cnt
    FROM glucose_day_counts(p_patient_id, p_from, p_to, p_tz)
  ),
  total AS (
    SELECT COALESCE(SUM(cnt), 0)::bigint AS n FROM classified
  ),
  counted AS (
    SELECT z.zone, COALESCE(SUM(c.cnt), 0)::bigint AS cnt
    FROM generate_series(1, 5) AS z(zone)
    LEFT JOIN classified c ON c.zone = z.zone
    GROUP BY z.zone
  ),
  scaled AS (
    SELECT
      counted.zone,
      (counted.cnt * 10000) / total.n AS whole,
      (counted.cnt * 10000) % total.n AS remainder
    FROM counted CROSS JOIN total
    WHERE total.n > 0
  ),
  ranked AS (
    SELECT
      zone,
      whole,
      ROW_NUMBER() OVER (ORDER BY remainder DESC, zone) AS place,
      10000 - SUM(whole) OVER () AS missing
    FROM scaled
  ),
  shares AS (
    SELECT zone, whole + CASE WHEN place <= missing THEN 1 ELSE 0 END AS hundredths
    FROM ranked
  )
  SELECT
    ROUND(MAX(hundredths) FILTER (WHERE zone = 1) / 100.0, 2) AS very_low_percent,
    ROUND(MAX(hundredths) FILTER (WHERE zone = 2) / 100.0, 2) AS low_percent,
    ROUND(MAX(hundredths) FILTER (WHERE zone = 3) / 100.0, 2) AS target_percent,
    ROUND(MAX(hundredths) FILTER (WHERE zone = 4) / 100.0, 2) AS high_percent,
    ROUND(MAX(hundredths) FILTER (WHERE zone = 5) / 100.0, 2) AS very_high_percent,
    (SELECT n FROM total) AS readings_count
  FROM shares
$$;

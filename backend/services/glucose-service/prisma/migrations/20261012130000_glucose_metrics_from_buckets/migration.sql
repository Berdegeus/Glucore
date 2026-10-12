-- The dashboard's TIR, GMI, CV, zones and per-day figures now come from the
-- glucose buckets (migration 20261012120000) wherever one exists, and from the
-- readings everywhere else. Every figure is derived from one relation,
-- `glucose_counts`: (moment, mg/dL, how many readings), so an interval read from
-- a bucket and one read from the readings are indistinguishable to what sits on
-- top.
--
-- A period's figures do not depend on a time zone; only the grouping into local
-- days does, and that is done by the caller from `moment`. A bucket is 15 minutes
-- aligned to UTC and every real zone's offset is a multiple of 15 minutes, so a
-- bucket falls wholly inside one local day whatever the zone.
--
-- Hand-written, like the migrations that created the functions this replaces
-- (20260831232506 and 20261004120000): Prisma cannot express stored functions.
-- `migrate dev --create-only` also proposes dropping
-- "GlucoseReading_patientId_recordedAt_desc_idx"; that DROP is not here on purpose.

-- The buckets that can stand in for the readings over [p_from, p_to): the ones
-- that lie wholly inside the range. A bucket the range cuts is ignored, and its
-- readings are used instead.
CREATE FUNCTION glucose_usable_buckets(p_patient_id uuid, p_from timestamp, p_to timestamp)
RETURNS TABLE (bucket_start timestamp, readings_count integer, covered_slots integer, mg_dl integer[], counts integer[])
LANGUAGE sql STABLE
AS $$
  SELECT b."bucketStart", b."readingsCount", b."coveredSlots", b."mgDl", b."counts"
  FROM "GlucoseBucket" b
  WHERE b."patientId" = p_patient_id
    AND b."bucketStart" >= p_from
    AND b."bucketStart" + interval '15 minutes' <= p_to
$$;

-- (moment, mg/dL, readings) over [p_from, p_to): a bucket contributes one row
-- per distinct value at its start, a reading outside every usable bucket one row
-- at its own instant. Values are clamped to 40..600 like the app clamps them, so
-- the two sources agree on a reading the sensor could not have produced.
CREATE FUNCTION glucose_counts(p_patient_id uuid, p_from timestamp, p_to timestamp)
RETURNS TABLE (moment timestamp, mg_dl integer, cnt bigint)
LANGUAGE sql STABLE
AS $$
  WITH usable AS MATERIALIZED (
    SELECT * FROM glucose_usable_buckets(p_patient_id, p_from, p_to)
  )
  SELECT u.bucket_start, v.mg, v.cnt::bigint
  FROM usable u
  CROSS JOIN LATERAL unnest(u.mg_dl, u.counts) AS v(mg, cnt)
  UNION ALL
  SELECT r."recordedAt", LEAST(600, GREATEST(40, r."valueMgDl")), 1::bigint
  FROM "GlucoseReading" r
  LEFT JOIN usable u
    ON u.bucket_start = date_bin('15 minutes', r."recordedAt", TIMESTAMP '2000-01-01')
  WHERE r."patientId" = p_patient_id
    AND r."recordedAt" >= p_from
    AND r."recordedAt" < p_to
    AND u.bucket_start IS NULL
$$;

-- 5-minute slots with at least one reading: what "the sensor was reporting"
-- means whatever the sensor's own cadence, and what sensor use is measured in.
-- A bucket's slots are the app's count, taken from the 1/min series; a reading
-- outside every usable bucket counts its own slot.
CREATE FUNCTION glucose_covered_slots(p_patient_id uuid, p_from timestamp, p_to timestamp)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  WITH usable AS MATERIALIZED (
    SELECT * FROM glucose_usable_buckets(p_patient_id, p_from, p_to)
  )
  SELECT
    COALESCE((SELECT SUM(covered_slots) FROM usable), 0)
    + (
      SELECT COUNT(DISTINCT floor(extract(epoch FROM r."recordedAt") / 300))
      FROM "GlucoseReading" r
      LEFT JOIN usable u
        ON u.bucket_start = date_bin('15 minutes', r."recordedAt", TIMESTAMP '2000-01-01')
      WHERE r."patientId" = p_patient_id
        AND r."recordedAt" >= p_from
        AND r."recordedAt" < p_to
        AND u.bucket_start IS NULL
    )
$$;

-- The return type changes (`covered_slots`), so the old function goes.
DROP FUNCTION glucose_metrics(uuid, timestamp, timestamp, integer, integer);

-- GMI, CV and TIR for the period. Mean and sample standard deviation come from
-- exact sums over the counts (n, sum x, sum x^2 in numeric), so they equal what
-- AVG and STDDEV_SAMP gave over the rows. `readings_count` counts the readings
-- the sensor produced (a bucket counts the minute series, not its thinning).
CREATE FUNCTION glucose_metrics(
  p_patient_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_low integer,
  p_high integer
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
    FROM glucose_counts(p_patient_id, p_from, p_to)
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
    glucose_covered_slots(p_patient_id, p_from, p_to) AS covered_slots
  FROM t
$$;

-- The five CGM zones as percentages, apportioned by the largest-remainder
-- method (see 20261004120000). Only the source of the counts changed; the
-- signature and the columns are the same, so this replaces it in place.
CREATE OR REPLACE FUNCTION glucose_zones(
  p_patient_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_low integer,
  p_high integer
)
RETURNS TABLE (
  very_low_percent numeric,
  low_percent numeric,
  target_percent numeric,
  high_percent numeric,
  very_high_percent numeric,
  readings_count bigint
)
LANGUAGE sql
STABLE
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
    FROM glucose_counts(p_patient_id, p_from, p_to)
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

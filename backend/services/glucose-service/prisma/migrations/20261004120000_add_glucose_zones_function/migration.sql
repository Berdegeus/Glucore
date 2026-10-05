-- Hand-written: Prisma cannot express stored functions. Sits next to
-- `glucose_metrics` (migration 20260831232506) and follows its conventions.

-- CreateFunction
-- The five CGM zones as percentages of the readings in [p_from, p_to), so the
-- patient dashboard, the professional portfolio and the app all read one
-- definition instead of re-deriving it:
--
--   very low   value <  LEAST(54, p_low)
--   low        LEAST(54, p_low) <= value < p_low
--   target     p_low <= value <= p_high
--   high       p_high < value <= GREATEST(250, p_high)
--   very high  value >  GREATEST(250, p_high)
--
-- LEAST/GREATEST keep the bands from overlapping when a patient's own
-- threshold sits past the international 54/250 marks (a low of 50 leaves no
-- "low" band at all; a high of 300 leaves no "high" band).
--
-- Percentages are in hundredths of a percent and are apportioned by the
-- largest-remainder method rather than rounded one by one: five independently
-- rounded values can add up to 99.98 or 100.02, and the contract is a sum of
-- 100 (tolerance 0.01). This way the sum is exactly 100.00 and each share is
-- within 0.01 of its true value. With no readings every percent is NULL, like
-- `tir_percent` in `glucose_metrics`.
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
        WHEN "valueMgDl" < LEAST(54, p_low) THEN 1
        WHEN "valueMgDl" < p_low THEN 2
        WHEN "valueMgDl" <= p_high THEN 3
        WHEN "valueMgDl" <= GREATEST(250, p_high) THEN 4
        ELSE 5
      END AS zone
    FROM "GlucoseReading"
    WHERE "patientId" = p_patient_id
      AND "recordedAt" >= p_from
      AND "recordedAt" < p_to
  ),
  total AS (
    SELECT COUNT(*) AS n FROM classified
  ),
  counted AS (
    SELECT z.zone, COUNT(c.zone) AS cnt
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
  FROM shares;
$$;

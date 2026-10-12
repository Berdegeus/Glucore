-- One row per patient-local day: counts of readings per whole mg/dL. The app
-- computes it from the sensor's 1/min series and uploads it next to the
-- 5-minute thinning of the readings themselves, so the dashboard's TIR, GMI and
-- CV can be exact for any target range. Shape: contracts/glucose-histogram.json
-- (561 bins, index 0 = 40 mg/dL, last = 600 mg/dL).
--
-- Hand-written: `migrate dev --create-only` also proposed dropping
-- "GlucoseReading_patientId_recordedAt_desc_idx" because Prisma cannot declare
-- a DESC index. That DROP is not here on purpose; do not add it. The CHECKs
-- and the function below are not something Prisma models either.

-- Sum of a histogram. CHECK cannot hold a subquery, but it can call an
-- immutable function, which is how the total is tied to readingsCount.
CREATE FUNCTION glucose_histogram_total(counts integer[]) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT COALESCE(SUM(c), 0)::bigint FROM unnest(counts) AS c $$;

-- CreateTable
CREATE TABLE "GlucoseDailySummary" (
    "patientId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "utcOffsetMinutes" INTEGER NOT NULL,
    "readingsCount" INTEGER NOT NULL,
    "coveredSlots" INTEGER NOT NULL,
    "histogram" INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlucoseDailySummary_pkey" PRIMARY KEY ("patientId","localDate"),
    CONSTRAINT "GlucoseDailySummary_histogram_shape_chk"
        CHECK (array_length("histogram", 1) = 561 AND 0 <= ALL ("histogram")),
    CONSTRAINT "GlucoseDailySummary_total_chk"
        CHECK (glucose_histogram_total("histogram") = "readingsCount" AND "readingsCount" > 0),
    CONSTRAINT "GlucoseDailySummary_slots_chk"
        CHECK ("coveredSlots" BETWEEN 0 AND 300 AND "coveredSlots" <= "readingsCount"),
    CONSTRAINT "GlucoseDailySummary_offset_chk"
        CHECK ("utcOffsetMinutes" BETWEEN -840 AND 840)
);

-- AddForeignKey
ALTER TABLE "GlucoseDailySummary" ADD CONSTRAINT "GlucoseDailySummary_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the days already on the server, from the readings it holds. The
-- readings carry no time zone, so the days are cut in America/Sao_Paulo (the
-- product's market; the dashboard's own default is UTC, which would shift every
-- Brazilian day by three hours). A day cut in another offset than the one a
-- dashboard request asks for is never used: the dashboard compares
-- "utcOffsetMinutes" with the request's offset and falls back to the readings.
-- The app overwrites these rows with its own, richer ones (larger count wins).
--
-- Marker used by tests/migrations/dailySummaryBackfill.test.ts: everything after
-- the next line is run on its own against seeded readings.
-- BACKFILL
WITH bucketed AS (
    SELECT
        "patientId",
        (("recordedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date AS day,
        LEAST(600, GREATEST(40, "valueMgDl")) AS mg,
        "recordedAt"
    FROM "GlucoseReading"
),
per_value AS (
    SELECT "patientId", day, mg, COUNT(*) AS cnt
    FROM bucketed
    GROUP BY "patientId", day, mg
),
per_day AS (
    SELECT
        "patientId",
        day,
        COUNT(*) AS readings,
        COUNT(DISTINCT floor(extract(epoch FROM "recordedAt") / 300)) AS slots
    FROM bucketed
    GROUP BY "patientId", day
)
INSERT INTO "GlucoseDailySummary"
    ("patientId", "localDate", "utcOffsetMinutes", "readingsCount", "coveredSlots", "histogram")
SELECT
    d."patientId",
    d.day,
    (extract(epoch FROM (
        (d.day + time '12:00')
        - ((d.day + time '12:00') AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC')
    )) / 60)::int,
    d.readings,
    d.slots,
    ARRAY(
        SELECT COALESCE(v.cnt, 0)::int
        FROM generate_series(40, 600) AS g(mg)
        LEFT JOIN per_value v ON v."patientId" = d."patientId" AND v.day = d.day AND v.mg = g.mg
        ORDER BY g.mg
    )
FROM per_day d
ON CONFLICT ("patientId", "localDate") DO NOTHING;

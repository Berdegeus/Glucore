-- One row per patient and 15-minute interval (aligned to UTC): the readings of
-- that interval counted per whole mg/dL. The app builds it from the sensor's
-- 1/min series and uploads it next to the 5-minute thinning of the readings
-- themselves, so the dashboard's TIR, GMI and CV can use the full resolution for
-- any target range. Shape: contracts/glucose-histogram.json.
--
-- Why 15 minutes in UTC, and not a day in the patient's zone: a day cut in one
-- zone cannot be re-cut in another. Every real zone's UTC offset is a multiple of
-- 15 minutes, so a bucket never straddles a local midnight, whatever the zone the
-- dashboard asks for.
--
-- Hand-written: `migrate dev --create-only` also proposed dropping
-- "GlucoseReading_patientId_recordedAt_desc_idx" because Prisma cannot declare
-- a DESC index. That DROP is not here on purpose; do not add it. The CHECKs
-- and the function below are not something Prisma models either.

-- Sum of an integer array. CHECK cannot hold a subquery, but it can call an
-- immutable function, which is how the total is tied to readingsCount.
CREATE FUNCTION glucose_counts_total(counts integer[]) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT COALESCE(SUM(c), 0)::bigint FROM unnest(counts) AS c $$;

-- CreateTable
CREATE TABLE "GlucoseBucket" (
    "patientId" UUID NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "readingsCount" INTEGER NOT NULL,
    "coveredSlots" INTEGER NOT NULL,
    "mgDl" INTEGER[],
    "counts" INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlucoseBucket_pkey" PRIMARY KEY ("patientId","bucketStart"),
    CONSTRAINT "GlucoseBucket_aligned_chk"
        CHECK ("bucketStart" = date_bin('15 minutes', "bucketStart", TIMESTAMP '2000-01-01')),
    CONSTRAINT "GlucoseBucket_values_chk"
        CHECK (
            cardinality("mgDl") BETWEEN 1 AND 561
            AND cardinality("mgDl") = cardinality("counts")
            AND 40 <= ALL ("mgDl") AND 600 >= ALL ("mgDl")
            AND 1 <= ALL ("counts")
        ),
    CONSTRAINT "GlucoseBucket_total_chk"
        CHECK ("readingsCount" > 0 AND glucose_counts_total("counts") = "readingsCount"),
    CONSTRAINT "GlucoseBucket_slots_chk"
        CHECK ("coveredSlots" BETWEEN 1 AND 3 AND "coveredSlots" <= "readingsCount")
);

-- AddForeignKey
ALTER TABLE "GlucoseBucket" ADD CONSTRAINT "GlucoseBucket_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the intervals already on the server, from the readings it holds.
-- Needs no time zone, which is the point of aligning to UTC. A reading is
-- clamped to 40..600 like the app does. The app overwrites these rows with its
-- own, richer ones (larger count wins).
--
-- Marker used by tests/migrations/bucketBackfill.test.ts: everything after the
-- next line is run on its own against seeded readings.
-- BACKFILL
-- One pass, no join: a join between two aggregates of the same CTE was planned as
-- a nested loop on a wrong row estimate and took minutes for ~130 thousand
-- readings. Here each (interval, value) carries a bit for each 5-minute slot it
-- was seen in, so the slots covered are counted from the bits without a second
-- aggregation over the readings.
WITH binned AS (
    SELECT
        "patientId",
        date_bin('15 minutes', "recordedAt", TIMESTAMP '2000-01-01') AS bucket,
        LEAST(600, GREATEST(40, "valueMgDl")) AS mg,
        -- Position of the 5-minute slot inside its 15-minute interval: 0, 1 or 2.
        (floor(extract(epoch FROM "recordedAt") / 300)::bigint % 3)::integer AS slot
    FROM "GlucoseReading"
),
per_value AS (
    SELECT
        "patientId",
        bucket,
        mg,
        COUNT(*) AS cnt,
        bit_or(1 << slot) AS slot_mask
    FROM binned
    GROUP BY "patientId", bucket, mg
)
INSERT INTO "GlucoseBucket"
    ("patientId", "bucketStart", "readingsCount", "coveredSlots", "mgDl", "counts")
SELECT
    "patientId",
    bucket,
    SUM(cnt)::integer,
    bit_count((bit_or(slot_mask))::bit(3))::integer,
    array_agg(mg ORDER BY mg),
    array_agg(cnt::integer ORDER BY mg)
FROM per_value
GROUP BY "patientId", bucket
ON CONFLICT ("patientId", "bucketStart") DO NOTHING;

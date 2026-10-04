-- CreateIndex
CREATE INDEX "AlertEvent_patientId_alertType_triggeredAt_idx" ON "AlertEvent"("patientId", "alertType", "triggeredAt");

-- Everything below is hand-written: Prisma 5 cannot express CHECK constraints,
-- partial indexes, or stored procedures, so `migrate dev --create-only` only
-- produced the index above. Read before touching this file.

-- CreateIndex
-- Serves "most recent N readings for a patient" — the range scan every diary
-- and the dashboard's period queries do. The @@unique([patientId, recordedAt])
-- Prisma already declares is ascending on both columns; this is a distinct
-- index tuned for DESC, which Prisma cannot declare.
CREATE INDEX "GlucoseReading_patientId_recordedAt_desc_idx"
  ON "GlucoseReading" ("patientId", "recordedAt" DESC);

-- CreateIndex (partial)
-- Clinically significant hypoglycemia is <70 mg/dL. A partial index keeps the
-- alert hot-path small instead of indexing every reading for a filter that
-- only ever matches a minority of rows.
CREATE INDEX "GlucoseReading_patientId_recordedAt_hypo_idx"
  ON "GlucoseReading" ("patientId", "recordedAt")
  WHERE "valueMgDl" < 70;

-- AddCheckConstraint
-- An inverted range makes every reading count as both hypo and hyper at once,
-- which breaks the dashboard's time-in-range math outright. The service layer
-- (settings.service.ts, phase 6) now rejects this with a 400 before it can
-- reach the database; this constraint is the backstop for every other write
-- path, present or future.
ALTER TABLE "AlertThresholdConfig"
  ADD CONSTRAINT "AlertThresholdConfig_low_lt_high_check"
  CHECK ("lowGlucoseMgDl" < "highGlucoseMgDl");

-- AddCheckConstraint
-- Same invariant as above, on the patient's own target range — today enforced
-- only in JS (PUT /auth/profile's validation, pre-split).
ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_targetRange_check"
  CHECK ("targetRangeMin" < "targetRangeMax" AND "targetRangeMin" > 0);

-- AddCheckConstraint
-- Mirrors the JS check on weightKg <= 0.
ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_weightKg_positive_check"
  CHECK ("weightKg" IS NULL OR "weightKg" > 0);

-- CreateIndex (partial unique)
-- A patient has at most one active sensor binding — nothing enforced this
-- before today; it lived only in whatever order the roadmap code that will
-- eventually write this table happens to call things in.
CREATE UNIQUE INDEX "SensorBinding_patientId_isCurrent_unique"
  ON "SensorBinding" ("patientId")
  WHERE "isCurrent";

-- CreateFunction
-- Centralizes the GMI and coefficient-of-variation formulas in one place
-- instead of duplicating them in TypeScript and SQL. STABLE because it only
-- reads within the same transaction/statement — never volatile, never writes.
CREATE OR REPLACE FUNCTION glucose_metrics(
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
  readings_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    AVG("valueMgDl")::numeric AS avg_glucose,
    (3.31 + 0.02392 * AVG("valueMgDl"))::numeric AS gmi,
    CASE WHEN AVG("valueMgDl") > 0
      THEN (100.0 * STDDEV_SAMP("valueMgDl") / AVG("valueMgDl"))::numeric
      ELSE NULL
    END AS cv,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(100.0 * COUNT(*) FILTER (WHERE "valueMgDl" BETWEEN p_low AND p_high) / COUNT(*), 2)
      ELSE NULL
    END AS tir_percent,
    COUNT(*) AS readings_count
  FROM "GlucoseReading"
  WHERE "patientId" = p_patient_id
    AND "recordedAt" >= p_from
    AND "recordedAt" < p_to;
$$;

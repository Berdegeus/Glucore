-- The administrator's overview counts readings per day across every patient,
-- which no patientId-led index can serve. A BRIN index on the append-only
-- recordedAt column answers that scan from a few kilobytes and adds almost
-- nothing to the write path.
--
-- Hand-written: `migrate dev --create-only` also proposed dropping
-- "GlucoseReading_patientId_recordedAt_desc_idx" because Prisma cannot declare
-- a DESC index, and would delete the one from migration 20260831232506. That
-- DROP is not here on purpose; do not add it.

-- CreateIndex
CREATE INDEX "GlucoseReading_recordedAt_brin_idx" ON "GlucoseReading" USING BRIN ("recordedAt");

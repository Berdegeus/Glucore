-- `migrate dev --create-only` also proposed dropping
-- "GlucoseReading_patientId_recordedAt_desc_idx": Prisma cannot declare a DESC
-- index, sees it as drift, and would delete the hand-written one from migration
-- 20260831232506. That DROP is removed here on purpose; do not re-add it.

-- AlterTable
ALTER TABLE "DashboardAccessGrant" ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PatientInvite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedBy" UUID,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientInvite_codeHash_key" ON "PatientInvite"("codeHash");

-- CreateIndex
CREATE INDEX "PatientInvite_patientId_createdAt_idx" ON "PatientInvite"("patientId", "createdAt");

-- AddForeignKey
ALTER TABLE "PatientInvite" ADD CONSTRAINT "PatientInvite_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everything below is hand-written: Prisma 5 cannot declare partial indexes.

-- CreateIndex (partial unique)
-- A patient has at most one pending invite (CON-03). `createInvite` revokes the
-- previous pending one in the same transaction, and this index is the backstop
-- that makes a concurrent double-generate fail instead of leaving two live codes.
CREATE UNIQUE INDEX "PatientInvite_patientId_pending_unique"
  ON "PatientInvite" ("patientId")
  WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

-- CreateIndex (partial unique)
-- A professional has at most one active grant per patient (CON-07): redeeming a
-- second code for a patient they already follow reuses the grant. A revoked
-- grant stays as history and does not block a new one.
CREATE UNIQUE INDEX "DashboardAccessGrant_patient_professional_active_unique"
  ON "DashboardAccessGrant" ("patientId", "healthProfessionalId")
  WHERE "revokedAt" IS NULL;

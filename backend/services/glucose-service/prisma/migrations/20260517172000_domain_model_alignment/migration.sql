CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'HEALTH_PROFESSIONAL', 'ADMINISTRATOR');
CREATE TYPE "SensorSessionState" AS ENUM (
    'IDLE',
    'CONNECTING',
    'CONNECTED',
    'MONITORING',
    'DISCONNECTED',
    'ERROR',
    'READING_UNAVAILABLE',
    'SENSOR_EXPIRED'
);
CREATE TYPE "SensorBrand" AS ENUM ('SIBIONICS_BLE', 'FREESTYLE_LIBRE', 'OTHER_COMPATIBLE');
CREATE TYPE "AlertType" AS ENUM (
    'HYPO_RISK',
    'HYPER_RISK',
    'FAST_DROP',
    'FAST_RISE',
    'SENSOR_RECONNECTED',
    'SYNC_FAILURE'
);

ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_userId_fkey";
ALTER TABLE "GlucoseReading" DROP CONSTRAINT IF EXISTS "GlucoseReading_userId_fkey";
ALTER TABLE "Alert" DROP CONSTRAINT IF EXISTS "Alert_userId_fkey";
ALTER TABLE "CarbEntry" DROP CONSTRAINT IF EXISTS "CarbEntry_userId_fkey";
ALTER TABLE "InsulinEntry" DROP CONSTRAINT IF EXISTS "InsulinEntry_userId_fkey";
ALTER TABLE "AlertSettings" DROP CONSTRAINT IF EXISTS "AlertSettings_userId_fkey";

ALTER TABLE "User" ADD COLUMN "newId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'PATIENT';
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "User"
SET "fullName" = COALESCE(NULLIF(split_part("email", '@', 1), ''), "email")
WHERE "fullName" IS NULL;

ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;

CREATE TABLE "Patient" (
    "userId" UUID NOT NULL,
    "birthDate" TIMESTAMP(3),
    "diabetesType" TEXT,
    "weightKg" DECIMAL(6,2),
    "targetRangeMin" INTEGER NOT NULL DEFAULT 80,
    "targetRangeMax" INTEGER NOT NULL DEFAULT 180,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("userId")
);

INSERT INTO "Patient" ("userId", "targetRangeMin", "targetRangeMax")
SELECT
    u."newId",
    COALESCE(s."lowThreshold", 80),
    COALESCE(s."highThreshold", 180)
FROM "User" u
LEFT JOIN "AlertSettings" s ON s."userId" = u."id";

CREATE TABLE "AuthCredential" (
    "userId" UUID NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "isMfaEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("userId")
);

INSERT INTO "AuthCredential" ("userId", "passwordHash")
SELECT "newId", "passwordHash"
FROM "User";

ALTER TABLE "PasswordResetToken" ADD COLUMN "newId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "PasswordResetToken" ADD COLUMN "newUserId" UUID;
ALTER TABLE "PasswordResetToken" ADD COLUMN "usedAt" TIMESTAMP(3);

UPDATE "PasswordResetToken" token
SET "newUserId" = u."newId"
FROM "User" u
WHERE token."userId" = u."id";

ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_pkey";
ALTER TABLE "PasswordResetToken" DROP COLUMN "id";
ALTER TABLE "PasswordResetToken" DROP COLUMN "userId";
ALTER TABLE "PasswordResetToken" RENAME COLUMN "newId" TO "id";
ALTER TABLE "PasswordResetToken" RENAME COLUMN "newUserId" TO "userId";
ALTER TABLE "PasswordResetToken" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id");

ALTER TABLE "GlucoseReading" DROP CONSTRAINT IF EXISTS "GlucoseReading_userId_timestampMs_key";
ALTER TABLE "GlucoseReading" ADD COLUMN "newId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "GlucoseReading" ADD COLUMN "patientId" UUID;
ALTER TABLE "GlucoseReading" ADD COLUMN "sensorSessionId" UUID;
ALTER TABLE "GlucoseReading" ADD COLUMN "recordedAt" TIMESTAMP(3);
ALTER TABLE "GlucoseReading" ADD COLUMN "valueMgDl" INTEGER;
ALTER TABLE "GlucoseReading" ADD COLUMN "trendRate" DOUBLE PRECISION;
ALTER TABLE "GlucoseReading" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'sensor';
ALTER TABLE "GlucoseReading" ADD COLUMN "isManual" BOOLEAN NOT NULL DEFAULT false;

UPDATE "GlucoseReading" reading
SET
    "patientId" = u."newId",
    "recordedAt" = to_timestamp(reading."timestampMs"::double precision / 1000.0)::timestamp(3),
    "valueMgDl" = ROUND(reading."value")::integer,
    "trendRate" = reading."rate"
FROM "User" u
WHERE reading."userId" = u."id";

ALTER TABLE "GlucoseReading" DROP CONSTRAINT IF EXISTS "GlucoseReading_pkey";
ALTER TABLE "GlucoseReading" DROP COLUMN "id";
ALTER TABLE "GlucoseReading" DROP COLUMN "userId";
ALTER TABLE "GlucoseReading" DROP COLUMN "value";
ALTER TABLE "GlucoseReading" DROP COLUMN "timestampMs";
ALTER TABLE "GlucoseReading" DROP COLUMN "rate";
ALTER TABLE "GlucoseReading" RENAME COLUMN "newId" TO "id";
ALTER TABLE "GlucoseReading" ALTER COLUMN "patientId" SET NOT NULL;
ALTER TABLE "GlucoseReading" ALTER COLUMN "recordedAt" SET NOT NULL;
ALTER TABLE "GlucoseReading" ALTER COLUMN "valueMgDl" SET NOT NULL;
ALTER TABLE "GlucoseReading" ALTER COLUMN "trendRate" SET NOT NULL;
ALTER TABLE "GlucoseReading" ALTER COLUMN "trend" SET DEFAULT 'stable';
ALTER TABLE "GlucoseReading" ADD CONSTRAINT "GlucoseReading_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "GlucoseReading_patientId_recordedAt_key" ON "GlucoseReading"("patientId", "recordedAt");
CREATE INDEX "GlucoseReading_sensorSessionId_idx" ON "GlucoseReading"("sensorSessionId");

ALTER TABLE "Alert" ADD COLUMN "newId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "Alert" ADD COLUMN "patientId" UUID;
ALTER TABLE "Alert" ADD COLUMN "glucosePredictionId" UUID;
ALTER TABLE "Alert" ADD COLUMN "triggeredAt" TIMESTAMP(3);
ALTER TABLE "Alert" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Alert" ADD COLUMN "alertType" "AlertType";
ALTER TABLE "Alert" ADD COLUMN "message" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Alert" ADD COLUMN "acknowledged" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Alert" alert
SET
    "patientId" = u."newId",
    "triggeredAt" = to_timestamp(alert."timestampMs"::double precision / 1000.0)::timestamp(3),
    "alertType" = CASE alert."type"
        WHEN 'glucoseLow' THEN 'HYPO_RISK'::"AlertType"
        WHEN 'glucoseHigh' THEN 'HYPER_RISK'::"AlertType"
        WHEN 'sensorReconnected' THEN 'SENSOR_RECONNECTED'::"AlertType"
        WHEN 'syncFailure' THEN 'SYNC_FAILURE'::"AlertType"
        WHEN 'HYPO_RISK' THEN 'HYPO_RISK'::"AlertType"
        WHEN 'HYPER_RISK' THEN 'HYPER_RISK'::"AlertType"
        WHEN 'FAST_DROP' THEN 'FAST_DROP'::"AlertType"
        WHEN 'FAST_RISE' THEN 'FAST_RISE'::"AlertType"
        ELSE 'SYNC_FAILURE'::"AlertType"
    END
FROM "User" u
WHERE alert."userId" = u."id";

ALTER TABLE "Alert" DROP CONSTRAINT IF EXISTS "Alert_pkey";
ALTER TABLE "Alert" DROP COLUMN "id";
ALTER TABLE "Alert" DROP COLUMN "userId";
ALTER TABLE "Alert" DROP COLUMN "type";
ALTER TABLE "Alert" DROP COLUMN "timestampMs";
ALTER TABLE "Alert" RENAME COLUMN "newId" TO "id";
ALTER TABLE "Alert" ALTER COLUMN "patientId" SET NOT NULL;
ALTER TABLE "Alert" ALTER COLUMN "triggeredAt" SET NOT NULL;
ALTER TABLE "Alert" ALTER COLUMN "alertType" SET NOT NULL;
ALTER TABLE "Alert" RENAME TO "AlertEvent";
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id");
CREATE INDEX "AlertEvent_patientId_triggeredAt_idx" ON "AlertEvent"("patientId", "triggeredAt");
CREATE INDEX "AlertEvent_glucosePredictionId_idx" ON "AlertEvent"("glucosePredictionId");

ALTER TABLE "CarbEntry" ADD COLUMN "newId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "CarbEntry" ADD COLUMN "patientId" UUID;
ALTER TABLE "CarbEntry" ADD COLUMN "eventAt" TIMESTAMP(3);
ALTER TABLE "CarbEntry" ADD COLUMN "carbsGrams" DECIMAL(10,2);

UPDATE "CarbEntry" carb
SET
    "patientId" = u."newId",
    "eventAt" = to_timestamp(carb."timeMs"::double precision / 1000.0)::timestamp(3),
    "carbsGrams" = carb."grams"
FROM "User" u
WHERE carb."userId" = u."id";

ALTER TABLE "CarbEntry" DROP CONSTRAINT IF EXISTS "CarbEntry_pkey";
ALTER TABLE "CarbEntry" DROP COLUMN "id";
ALTER TABLE "CarbEntry" DROP COLUMN "userId";
ALTER TABLE "CarbEntry" DROP COLUMN "grams";
ALTER TABLE "CarbEntry" DROP COLUMN "timeMs";
ALTER TABLE "CarbEntry" RENAME COLUMN "newId" TO "id";
ALTER TABLE "CarbEntry" ALTER COLUMN "patientId" SET NOT NULL;
ALTER TABLE "CarbEntry" ALTER COLUMN "eventAt" SET NOT NULL;
ALTER TABLE "CarbEntry" ALTER COLUMN "carbsGrams" SET NOT NULL;
ALTER TABLE "CarbEntry" RENAME TO "CarbEvent";
ALTER TABLE "CarbEvent" ADD CONSTRAINT "CarbEvent_pkey" PRIMARY KEY ("id");
CREATE INDEX "CarbEvent_patientId_eventAt_idx" ON "CarbEvent"("patientId", "eventAt");

ALTER TABLE "InsulinEntry" ADD COLUMN "newId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "InsulinEntry" ADD COLUMN "patientId" UUID;
ALTER TABLE "InsulinEntry" ADD COLUMN "eventAt" TIMESTAMP(3);
ALTER TABLE "InsulinEntry" ADD COLUMN "insulinType" TEXT;
ALTER TABLE "InsulinEntry" ADD COLUMN "doseUnits" DECIMAL(10,2);
ALTER TABLE "InsulinEntry" ADD COLUMN "description" TEXT;

UPDATE "InsulinEntry" insulin
SET
    "patientId" = u."newId",
    "eventAt" = to_timestamp(insulin."timeMs"::double precision / 1000.0)::timestamp(3),
    "insulinType" = insulin."type",
    "doseUnits" = insulin."units"
FROM "User" u
WHERE insulin."userId" = u."id";

ALTER TABLE "InsulinEntry" DROP CONSTRAINT IF EXISTS "InsulinEntry_pkey";
ALTER TABLE "InsulinEntry" DROP COLUMN "id";
ALTER TABLE "InsulinEntry" DROP COLUMN "userId";
ALTER TABLE "InsulinEntry" DROP COLUMN "units";
ALTER TABLE "InsulinEntry" DROP COLUMN "type";
ALTER TABLE "InsulinEntry" DROP COLUMN "timeMs";
ALTER TABLE "InsulinEntry" RENAME COLUMN "newId" TO "id";
ALTER TABLE "InsulinEntry" ALTER COLUMN "patientId" SET NOT NULL;
ALTER TABLE "InsulinEntry" ALTER COLUMN "eventAt" SET NOT NULL;
ALTER TABLE "InsulinEntry" ALTER COLUMN "insulinType" SET NOT NULL;
ALTER TABLE "InsulinEntry" ALTER COLUMN "doseUnits" SET NOT NULL;
ALTER TABLE "InsulinEntry" RENAME TO "InsulinEvent";
ALTER TABLE "InsulinEvent" ADD CONSTRAINT "InsulinEvent_pkey" PRIMARY KEY ("id");
CREATE INDEX "InsulinEvent_patientId_eventAt_idx" ON "InsulinEvent"("patientId", "eventAt");

ALTER TABLE "AlertSettings" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "AlertSettings" ADD COLUMN "patientId" UUID;
ALTER TABLE "AlertSettings" ADD COLUMN "lowGlucoseMgDl" INTEGER;
ALTER TABLE "AlertSettings" ADD COLUMN "highGlucoseMgDl" INTEGER;
ALTER TABLE "AlertSettings" ADD COLUMN "predictionWindowMin" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "AlertSettings" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AlertSettings" settings
SET
    "patientId" = u."newId",
    "lowGlucoseMgDl" = settings."lowThreshold",
    "highGlucoseMgDl" = settings."highThreshold"
FROM "User" u
WHERE settings."userId" = u."id";

ALTER TABLE "AlertSettings" DROP CONSTRAINT IF EXISTS "AlertSettings_pkey";
ALTER TABLE "AlertSettings" DROP COLUMN "userId";
ALTER TABLE "AlertSettings" DROP COLUMN "lowThreshold";
ALTER TABLE "AlertSettings" DROP COLUMN "highThreshold";
ALTER TABLE "AlertSettings" ALTER COLUMN "patientId" SET NOT NULL;
ALTER TABLE "AlertSettings" ALTER COLUMN "lowGlucoseMgDl" SET NOT NULL;
ALTER TABLE "AlertSettings" ALTER COLUMN "highGlucoseMgDl" SET NOT NULL;
ALTER TABLE "AlertSettings" RENAME TO "AlertThresholdConfig";
ALTER TABLE "AlertThresholdConfig" ADD CONSTRAINT "AlertThresholdConfig_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "AlertThresholdConfig_patientId_key" ON "AlertThresholdConfig"("patientId");

INSERT INTO "AlertThresholdConfig" (
    "patientId",
    "lowGlucoseMgDl",
    "highGlucoseMgDl",
    "predictionWindowMin"
)
SELECT
    p."userId",
    p."targetRangeMin",
    p."targetRangeMax",
    30
FROM "Patient" p
WHERE NOT EXISTS (
    SELECT 1
    FROM "AlertThresholdConfig" config
    WHERE config."patientId" = p."userId"
);

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE "User" DROP COLUMN "id";
ALTER TABLE "User" RENAME COLUMN "newId" TO "id";
ALTER TABLE "User" DROP COLUMN "passwordHash";
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

CREATE TABLE "HealthProfessional" (
    "userId" UUID NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,

    CONSTRAINT "HealthProfessional_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Administrator" (
    "userId" UUID NOT NULL,
    "employeeCode" TEXT NOT NULL,

    CONSTRAINT "Administrator_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SensorDevice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "serialNumber" TEXT NOT NULL,
    "sensorBrand" "SensorBrand" NOT NULL,
    "model" TEXT,
    "firmwareVersion" TEXT,
    "hardwareVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SensorDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SensorBinding" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "sensorDeviceId" UUID NOT NULL,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unboundAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SensorBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SensorSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sensorDeviceId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "accessCode" TEXT,
    "state" "SensorSessionState" NOT NULL DEFAULT 'IDLE',
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "SensorSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SensorStatusEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sensorSessionId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "batteryPct" INTEGER,

    CONSTRAINT "SensorStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GlucosePrediction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "glucoseReadingId" UUID NOT NULL,
    "alertThresholdConfigId" UUID NOT NULL,
    "predictedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horizonMinutes" INTEGER NOT NULL,
    "predictedMgDl" INTEGER NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "GlucosePrediction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalReport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,

    CONSTRAINT "ClinicalReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetricsSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinicalReportId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "avgGlucose" DECIMAL(8,2) NOT NULL,
    "timeInRangePct" DECIMAL(5,2) NOT NULL,
    "hypoPercent" DECIMAL(5,2) NOT NULL,
    "hyperPercent" DECIMAL(5,2) NOT NULL,
    "gmi" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "MetricsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DashboardAccessGrant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "healthProfessionalId" UUID NOT NULL,
    "clinicalReportId" UUID,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "permissionLevel" TEXT NOT NULL,

    CONSTRAINT "DashboardAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SensorDevice_serialNumber_key" ON "SensorDevice"("serialNumber");
CREATE INDEX "AuthSession_userId_isRevoked_idx" ON "AuthSession"("userId", "isRevoked");
CREATE INDEX "SensorBinding_patientId_isCurrent_idx" ON "SensorBinding"("patientId", "isCurrent");
CREATE INDEX "SensorBinding_sensorDeviceId_idx" ON "SensorBinding"("sensorDeviceId");
CREATE INDEX "SensorSession_sensorDeviceId_startedAt_idx" ON "SensorSession"("sensorDeviceId", "startedAt");
CREATE INDEX "SensorStatusEvent_sensorSessionId_occurredAt_idx" ON "SensorStatusEvent"("sensorSessionId", "occurredAt");
CREATE INDEX "GlucosePrediction_glucoseReadingId_idx" ON "GlucosePrediction"("glucoseReadingId");
CREATE INDEX "GlucosePrediction_alertThresholdConfigId_idx" ON "GlucosePrediction"("alertThresholdConfigId");
CREATE INDEX "ClinicalReport_patientId_generatedAt_idx" ON "ClinicalReport"("patientId", "generatedAt");
CREATE INDEX "MetricsSnapshot_clinicalReportId_idx" ON "MetricsSnapshot"("clinicalReportId");
CREATE INDEX "DashboardAccessGrant_patientId_idx" ON "DashboardAccessGrant"("patientId");
CREATE INDEX "DashboardAccessGrant_healthProfessionalId_idx" ON "DashboardAccessGrant"("healthProfessionalId");
CREATE INDEX "DashboardAccessGrant_clinicalReportId_idx" ON "DashboardAccessGrant"("clinicalReportId");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthProfessional" ADD CONSTRAINT "HealthProfessional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Administrator" ADD CONSTRAINT "Administrator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthCredential" ADD CONSTRAINT "AuthCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensorBinding" ADD CONSTRAINT "SensorBinding_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensorBinding" ADD CONSTRAINT "SensorBinding_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "SensorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensorSession" ADD CONSTRAINT "SensorSession_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "SensorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensorStatusEvent" ADD CONSTRAINT "SensorStatusEvent_sensorSessionId_fkey" FOREIGN KEY ("sensorSessionId") REFERENCES "SensorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlucoseReading" ADD CONSTRAINT "GlucoseReading_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlucoseReading" ADD CONSTRAINT "GlucoseReading_sensorSessionId_fkey" FOREIGN KEY ("sensorSessionId") REFERENCES "SensorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlertThresholdConfig" ADD CONSTRAINT "AlertThresholdConfig_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlucosePrediction" ADD CONSTRAINT "GlucosePrediction_glucoseReadingId_fkey" FOREIGN KEY ("glucoseReadingId") REFERENCES "GlucoseReading"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlucosePrediction" ADD CONSTRAINT "GlucosePrediction_alertThresholdConfigId_fkey" FOREIGN KEY ("alertThresholdConfigId") REFERENCES "AlertThresholdConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_glucosePredictionId_fkey" FOREIGN KEY ("glucosePredictionId") REFERENCES "GlucosePrediction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CarbEvent" ADD CONSTRAINT "CarbEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsulinEvent" ADD CONSTRAINT "InsulinEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalReport" ADD CONSTRAINT "ClinicalReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricsSnapshot" ADD CONSTRAINT "MetricsSnapshot_clinicalReportId_fkey" FOREIGN KEY ("clinicalReportId") REFERENCES "ClinicalReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardAccessGrant" ADD CONSTRAINT "DashboardAccessGrant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardAccessGrant" ADD CONSTRAINT "DashboardAccessGrant_healthProfessionalId_fkey" FOREIGN KEY ("healthProfessionalId") REFERENCES "HealthProfessional"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardAccessGrant" ADD CONSTRAINT "DashboardAccessGrant_clinicalReportId_fkey" FOREIGN KEY ("clinicalReportId") REFERENCES "ClinicalReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AlertEvent" ALTER COLUMN "triggeredAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AlertThresholdConfig" ALTER COLUMN "lowGlucoseMgDl" SET DEFAULT 80,
ALTER COLUMN "highGlucoseMgDl" SET DEFAULT 180,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlucoseReading" ALTER COLUMN "trendRate" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

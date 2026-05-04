-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlucoseReading" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestampMs" BIGINT NOT NULL,
    "trend" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alarmCode" INTEGER,

    CONSTRAINT "GlucoseReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "timestampMs" BIGINT NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarbEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "grams" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "timeMs" BIGINT NOT NULL,

    CONSTRAINT "CarbEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsulinEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "timeMs" BIGINT NOT NULL,

    CONSTRAINT "InsulinEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSettings" (
    "userId" INTEGER NOT NULL,
    "lowThreshold" INTEGER NOT NULL DEFAULT 80,
    "highThreshold" INTEGER NOT NULL DEFAULT 180,

    CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GlucoseReading_userId_timestampMs_key" ON "GlucoseReading"("userId", "timestampMs");

-- AddForeignKey
ALTER TABLE "GlucoseReading" ADD CONSTRAINT "GlucoseReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarbEntry" ADD CONSTRAINT "CarbEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsulinEntry" ADD CONSTRAINT "InsulinEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSettings" ADD CONSTRAINT "AlertSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

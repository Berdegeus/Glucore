ALTER TABLE "Patient"
ALTER COLUMN "birthDate" TYPE DATE
USING "birthDate"::date;

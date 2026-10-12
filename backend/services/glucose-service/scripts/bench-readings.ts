/**
 * Measures the write path of `PrismaReadingRepository.upsertMany` against a
 * real Postgres: wall time and SQL commands for a sensor backfill.
 *
 *   cd backend/services/glucose-service
 *   BENCH_DATABASE_URL=postgresql://user@localhost:5432/glucore_test?schema=public \
 *     npx ts-node --transpile-only scripts/bench-readings.ts [rows] [stepMinutes]
 *
 * Defaults: 20160 rows (14 days at 1/min). It inserts them under a throwaway
 * patient, sends the same rows again (the update path, which is what a resend
 * after a lost response costs) and deletes the patient. Point it at a scratch
 * database such as `glucore_test`, never at production.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';

import { MAX_READING_BATCH, type ReadingInput } from '../src/modules/readings/readings.schema';
import { PrismaReadingRepository } from '../src/modules/readings/readings.repository';

loadDotenv({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

const rows = Number(process.argv[2] ?? 20160);
const stepMinutes = Number(process.argv[3] ?? 1);
const url =
  process.env.BENCH_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/glucore_test?schema=public';

const prisma = new PrismaClient({
  datasources: { db: { url } },
  log: [{ emit: 'event', level: 'query' }],
});

let commands = 0;
prisma.$on('query', () => {
  commands += 1;
});

function buildReadings(count: number): ReadingInput[] {
  const stepMs = stepMinutes * 60_000;
  const end = Math.floor(Date.now() / stepMs) * stepMs;
  return Array.from({ length: count }, (_, i) => ({
    value: 90 + ((i * 7) % 110),
    timestampMs: end - (count - 1 - i) * stepMs,
    trend: 'stable',
    rate: ((i % 5) - 2) / 10,
    alarmCode: i % 97 === 0 ? 3 : undefined,
  }));
}

async function pass(
  label: string,
  repository: PrismaReadingRepository,
  patientId: string,
  readings: ReadingInput[],
): Promise<void> {
  commands = 0;
  const started = process.hrtime.bigint();
  for (let i = 0; i < readings.length; i += MAX_READING_BATCH) {
    await repository.upsertMany(patientId, readings.slice(i, i + MAX_READING_BATCH));
  }
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const requests = Math.ceil(readings.length / MAX_READING_BATCH);
  console.log(
    `${label.padEnd(8)} rows=${readings.length} requests=${requests} ` +
      `sql_commands=${commands} wall_ms=${ms.toFixed(0)} ` +
      `ms_per_request=${(ms / requests).toFixed(1)}`,
  );
}

async function main(): Promise<void> {
  const patientId = randomUUID();
  const repository = new PrismaReadingRepository(prisma);
  const readings = buildReadings(rows);

  await prisma.patient.create({ data: { userId: patientId } });
  try {
    await pass('insert', repository, patientId, readings);
    await pass('resend', repository, patientId, readings);
    const stored = await prisma.glucoseReading.count({ where: { patientId } });
    console.log(`stored=${stored}`);
  } finally {
    await prisma.patient.delete({ where: { userId: patientId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

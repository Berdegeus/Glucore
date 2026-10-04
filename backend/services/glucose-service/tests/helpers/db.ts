import { signAccessToken } from '@glucore/shared';

import { prisma } from '../../src/lib/prisma';

import { TEST_JWT_SECRET } from './testEnv';

/**
 * Empties every application table between test cases.
 *
 * The table list is read from the catalogue rather than hardcoded so a new model
 * cannot silently start leaking state across tests. `_prisma_migrations` is kept:
 * dropping it would make globalSetup re-run every migration on the next file.
 */
export async function truncateAll(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;

  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export interface SignedInPatient {
  token: string;
  userId: string;
}

let sequence = 0;

/**
 * Seeds a patient and returns a bearer token for them.
 *
 * This used to be `registerUser`, and it went through `POST /auth/register`
 * followed by `GET /auth/status` — deliberately, so the fixture would exercise
 * the same path a real client does, including the nested Patient and
 * AlertThresholdConfig creation the refactor had to preserve.
 *
 * That reasoning expired with the split. Registration happens in auth-service
 * now, against another database; this service has no `/auth` to call and no
 * `User` table to write. What it does have is a userId arriving in a verified
 * token, so the fixture mints one directly — which is exactly the shape of a
 * real request here, and is now the honest imitation.
 *
 * The alert thresholds are seeded alongside the patient because registration is
 * where they used to come from, and every settings test reads them. Their
 * values match the defaults the mapper falls back to, so a test that never
 * touches them sees the same numbers either way.
 */
export async function signedInPatient(
  overrides: { targetRangeMin?: number; targetRangeMax?: number } = {},
): Promise<SignedInPatient> {
  sequence += 1;
  const userId = deterministicUuid(sequence);
  const targetRangeMin = overrides.targetRangeMin ?? 80;
  const targetRangeMax = overrides.targetRangeMax ?? 180;

  await prisma.patient.create({
    data: {
      userId,
      targetRangeMin,
      targetRangeMax,
      alertThresholdConfig: {
        create: { lowGlucoseMgDl: targetRangeMin, highGlucoseMgDl: targetRangeMax },
      },
    },
  });

  return {
    userId,
    token: signAccessToken({ sub: userId, role: 'PATIENT' }, TEST_JWT_SECRET),
  };
}

/**
 * A valid v4 UUID that varies per call.
 *
 * `Patient.userId` is a `uuid` column, so the id has to parse as one — and the
 * ids no longer come from a database default, since the row this service used
 * to follow lives elsewhere. Derived from a counter rather than random so a
 * failing test names the same id when it is re-run.
 */
function deterministicUuid(n: number): string {
  const tail = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

export { prisma };

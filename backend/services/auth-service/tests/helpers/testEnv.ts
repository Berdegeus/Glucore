import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

/**
 * Resolves the database this service's test run must use — its own, not
 * glucose-service's. Two services, two databases, including under test: sharing
 * one would let a fixture here mask a missing table there.
 *
 * Shared by `vitest.config.ts` and `globalSetup.ts` because `test.env` in the
 * config only reaches the worker processes — globalSetup runs in the main
 * process and would otherwise see no DATABASE_URL at all.
 */
// Resolved from this file rather than the process cwd: the vitest workspace at
// the backend root runs each project with cwd set there, not in the service.
loadDotenv({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

export const TEST_DATABASE_URL =
  process.env.TEST_AUTH_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/glucore_auth_test?schema=public';

// The same secret glucose-service's suite uses. That is the point: a token
// minted here has to verify there, and a mismatch would show up as every
// cross-service request failing with 401.
export const TEST_JWT_SECRET = 'test-secret-for-integration-tests';

// Distinct from TEST_JWT_SECRET, mirroring the production split. Shared with
// glucose-service's suite so a gateway-signed internal token in a test can
// verify against either service.
export const TEST_INTERNAL_JWT_SECRET = 'test-internal-secret-for-integration-tests';

/** Cheapest work factor bcrypt accepts. See lib/passwordHasher.ts. */
export const TEST_BCRYPT_ROUNDS = 4;

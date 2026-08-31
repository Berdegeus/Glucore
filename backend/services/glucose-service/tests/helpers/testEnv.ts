import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

/**
 * Resolves the database the test run must use.
 *
 * Shared by `vitest.config.ts` and `globalSetup.ts` because `test.env` in the
 * config only reaches the worker processes — globalSetup runs in the main
 * process and would otherwise see no DATABASE_URL at all.
 *
 * `.env.test` is gitignored and machine-specific (see `.env.test.example`); the
 * fallback is the shape CI's postgres service container exposes.
 */
// Resolved from this file rather than the process cwd: the vitest workspace at
// the backend root runs each project with cwd set there, not in the service.
loadDotenv({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/glucore_test?schema=public';

export const TEST_JWT_SECRET = 'test-secret-for-integration-tests';

// Distinct from TEST_JWT_SECRET, mirroring the production split. Same literal
// as auth-service's copy, so a gateway-signed internal token in a test can
// verify against either service.
export const TEST_INTERNAL_JWT_SECRET = 'test-internal-secret-for-integration-tests';

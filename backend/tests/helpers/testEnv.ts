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
loadDotenv({ path: '.env.test', quiet: true });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/glucore_test?schema=public';

export const TEST_JWT_SECRET = 'test-secret-for-integration-tests';

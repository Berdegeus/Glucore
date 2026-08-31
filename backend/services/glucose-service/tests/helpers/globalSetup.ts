import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { TEST_DATABASE_URL } from './testEnv';

/** This service's root, where prisma/schema.prisma lives. */
const SERVICE_ROOT = path.resolve(__dirname, '../..');

/**
 * Brings the test database up to the current migration set, once per run.
 *
 * `migrate deploy` (not `migrate dev`) is deliberate: it applies the committed
 * migrations and nothing else, so the schema under test is byte-identical to the
 * one production gets. If it could not run, fail loudly here rather than let
 * every integration test fail one by one with an opaque Prisma error.
 */
export default function setup(): void {
  const databaseUrl = TEST_DATABASE_URL;

  if (!/glucore_test|_test(\?|$)/.test(databaseUrl)) {
    throw new Error(
      `Refusing to run migrations against "${databaseUrl}": the test database ` +
        'name must contain "_test". This guard exists because the suite truncates ' +
        'every table between cases.',
    );
  }

  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      // Pinned to the service root: run from the workspace root instead, prisma
      // would look for prisma/schema.prisma in backend/ and find nothing.
      cwd: SERVICE_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      // Windows resolves `npx` as `npx.cmd`. Passing the extension directly
      // (without `shell`) throws EINVAL on Node >= 18.19/20.11/21.6 (the
      // CVE-2024-27980 fix requires a shell for .cmd/.bat). `shell: true` is
      // the workaround Node's own advisory documents; safe here because both
      // the command and its args are hardcoded, never user input.
      shell: true,
    });
  } catch (error) {
    const detail =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr: Buffer }).stderr)
        : String(error);
    throw new Error(
      `Could not migrate the test database at ${databaseUrl}.\n` +
        'Start PostgreSQL and create the database (createdb glucore_test), or point\n' +
        'TEST_DATABASE_URL at another one via backend/.env.test.\n\n' +
        detail,
    );
  }
}

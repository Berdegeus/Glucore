import path from 'node:path';

import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL, TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from './tests/helpers/testEnv';

/**
 * Project-level config for glucose-service.
 *
 * Global options (fileParallelism, coverage, thresholds) live in the workspace
 * root config — Vitest resolves those once for the whole run and ignores them
 * here.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Point at the source, not at packages/shared/dist. Coverage is measured
      // over `packages/*/src/**`, so resolving the built JS would leave every
      // shared module reported at 0 % while its code ran under a path the
      // report never looks at. It also drops the "rebuild before you test"
      // step, so a test can never pass against a stale dist.
      '@glucore/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/helpers/globalSetup.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: TEST_JWT_SECRET,
      INTERNAL_JWT_SECRET: TEST_INTERNAL_JWT_SECRET,
      // Keep the SMTP branch of the password-reset flow deterministic: with no
      // host configured the mailer throws and the route logs the token instead.
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
    },
  },
});

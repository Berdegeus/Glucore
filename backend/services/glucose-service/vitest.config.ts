import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL, TEST_JWT_SECRET } from './tests/helpers/testEnv';

/**
 * Project-level config for glucose-service.
 *
 * Global options (fileParallelism, coverage, thresholds) live in the workspace
 * root config — Vitest resolves those once for the whole run and ignores them
 * here.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/helpers/globalSetup.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: TEST_JWT_SECRET,
      // Keep the SMTP branch of the password-reset flow deterministic: with no
      // host configured the mailer throws and the route logs the token instead.
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
    },
  },
});

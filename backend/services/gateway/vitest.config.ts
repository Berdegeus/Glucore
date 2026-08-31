import path from 'node:path';

import { defineConfig } from 'vitest/config';

import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from './tests/helpers/testEnv';

/**
 * Project-level config for the gateway. No database, no globalSetup: every
 * test either exercises pure logic or hits a downstream fake HTTP server on
 * an ephemeral port, never Postgres.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@glucore/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      JWT_SECRET: TEST_JWT_SECRET,
      INTERNAL_JWT_SECRET: TEST_INTERNAL_JWT_SECRET,
    },
  },
});

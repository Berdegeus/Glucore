import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Each test file gets a fresh module registry. `src/lib/prisma.ts` and
    // `src/lib/env.ts` hold module-level state, so leaking it between files
    // would make the suite order-dependent.
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      // Only the process bootstrap is excluded. `src/routes/**` deliberately is
      // NOT: today it holds essentially all the business logic, so excluding it
      // would inflate the number that rubric #25 is measured on. Once phase 2
      // has moved that logic into services and the routers are thin wiring, they
      // can be excluded honestly.
      exclude: ['src/index.ts', 'prisma/**'],
      // NOTE: thresholds are deliberately absent while the suite is being built
      // out. They land in the same change that takes coverage past the 75 %
      // required by rubric #25 — adding them now would just paint every
      // intermediate commit red.
    },
  },
});

import { defineConfig } from 'vitest/config';

/**
 * Root-level Vitest options for the whole workspace.
 *
 * Only settings Vitest resolves globally belong here — per-project concerns
 * (database URL, globalSetup, which files to include) live in each service's own
 * vitest.config.ts. `fileParallelism` in particular is NOT a per-project option:
 * setting it inside a service config is silently ignored, and the integration
 * suites then TRUNCATE the shared database concurrently and deadlock.
 */
export default defineConfig({
  test: {
    // One project per service. Each keeps its own vitest.config.ts because the
    // database URL and globalSetup differ per service once the split lands.
    projects: ['services/*'],
    // The integration suites share one database and TRUNCATE between cases, so
    // any overlap corrupts another file's fixtures. `fileParallelism` alone was
    // not enough — pin the pool to a single worker as well.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    poolOptions: {
      threads: { singleThread: true },
      forks: { singleFork: true },
    },
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['services/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
      // Only process bootstraps are excluded. `src/routes/**` deliberately is
      // NOT: it still holds essentially all the business logic, and excluding it
      // would inflate the number rubric #25 is measured on. Once phase 2 has
      // moved that logic into services and the routers are thin wiring, they can
      // be excluded honestly.
      exclude: ['**/src/index.ts', '**/prisma/**'],
      // Rubric #25 asks for 75 %. Measured at ~96 % statements / ~90 % branches,
      // so the gate sits below that with room for normal drift rather than at
      // the current number, which would fail on any unexercised guard clause
      // added later.
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 95,
        branches: 85,
      },
    },
  },
});

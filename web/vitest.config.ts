import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

const CORE_LAYERS = 'src/**/{domain,application}/**/*.test.ts';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        // domain and application run without a DOM (ARQ-04).
        extends: true,
        test: { name: 'core', include: [CORE_LAYERS], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, CORE_LAYERS],
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
        },
      },
      {
        // Architecture, deploy and docs guards: plain Node. They drive ESLint,
        // dependency-cruiser and jscpd, whose cold start after `npm ci` can
        // pass the default 5 s on a CI runner.
        extends: true,
        test: { name: 'tooling', include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 30_000 },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
      // ARQ-13: the core layers carry the rules, so they carry the gate.
      thresholds: {
        'src/**/domain/**': { lines: 80 },
        'src/**/application/**': { lines: 80 },
      },
    },
  },
});

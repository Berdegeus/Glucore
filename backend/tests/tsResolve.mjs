/**
 * Test-only module resolution shim.
 *
 * `npm test` runs the TypeScript sources through Node's native type stripping,
 * which loads them as ES modules. ESM resolution demands an explicit file
 * extension, but `src/` is compiled by `tsc` with `module: commonjs`, where
 * writing `from '../lib/env.ts'` is a compile error (TS5097). So the sources
 * keep extensionless relative imports and this hook appends `.ts` for them.
 *
 * Registered via `--import` in the `test` script so it is active before any
 * test file loads. It never affects `npm run dev`, `npm run build` or `tsc`.
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HAS_EXTENSION = /\.[cm]?[jt]s$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !HAS_EXTENSION.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

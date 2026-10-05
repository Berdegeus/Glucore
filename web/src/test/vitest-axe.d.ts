import 'vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

// vitest-axe 0.1 still augments the pre-1.0 `Vi` namespace, which current
// Vitest ignores; this is the same augmentation in today's form.
declare module 'vitest' {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- interface merging must repeat Vitest's own `Assertion<T = any>` declaration */
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- end of the augmentation */
}

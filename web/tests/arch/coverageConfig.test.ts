import { describe, expect, it } from 'vitest';
import config from '../../vitest.config';

// ARQ-13: line coverage of at least 80 % in domain and application, failing
// `npm run test:coverage` (and CI) below it.

describe('coverage gate (vitest.config.ts)', () => {
  const coverage = config.test?.coverage;
  const thresholds = coverage && 'thresholds' in coverage ? coverage.thresholds : undefined;

  it('measures coverage with v8', () => {
    expect(coverage?.provider).toBe('v8');
  });

  it('requires 80 % of lines in domain and in application', () => {
    expect(thresholds).toMatchObject({
      'src/**/domain/**': { lines: 80 },
      'src/**/application/**': { lines: 80 },
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadEnv, MissingEnvError } from '../../src/lib/env';

/**
 * Only the CORS_ORIGIN-in-production rule: the rest of `loadEnv` (port,
 * bcrypt rounds, SMTP all-or-nothing) is exercised indirectly by every route
 * test that calls `buildTestApp`.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

function baseEnv(): void {
  vi.stubEnv('JWT_SECRET', 'a-secret');
  vi.stubEnv('PORT', '3002');
}

describe('loadEnv — CORS_ORIGIN', () => {
  it('requires CORS_ORIGIN in production', () => {
    baseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(() => loadEnv()).toThrow(MissingEnvError);
    expect(() => loadEnv()).toThrow(/CORS_ORIGIN is not set/);
  });

  it('accepts a configured CORS_ORIGIN in production', () => {
    baseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');
    expect(loadEnv().corsOrigins).toEqual(['https://app.example.com']);
  });

  it('stays permissive outside production', () => {
    baseEnv();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(loadEnv().corsOrigins).toEqual([]);
  });
});

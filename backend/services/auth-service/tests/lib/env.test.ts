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

describe('loadEnv — SMTP and WEB_APP_URL', () => {
  function fullEnv(): void {
    baseEnv();
    vi.stubEnv('INTERNAL_JWT_SECRET', 'internal');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_USER', 'user');
    vi.stubEnv('SMTP_PASS', 'pass');
  }

  it('needs host, user, pass and from together; otherwise there is no SMTP', () => {
    fullEnv();
    vi.stubEnv('SMTP_FROM', '');
    expect(loadEnv().smtp).toBeNull();
    vi.stubEnv('SMTP_FROM', 'noreply@example.com');
    expect(loadEnv().smtp).toMatchObject({ host: 'smtp.example.com', port: 587, from: 'noreply@example.com' });
  });

  it('trims a trailing slash from WEB_APP_URL and rejects a non-URL', () => {
    fullEnv();
    vi.stubEnv('WEB_APP_URL', 'https://web.example.com/');
    expect(loadEnv().webAppUrl).toBe('https://web.example.com');
    vi.stubEnv('WEB_APP_URL', 'not a url');
    expect(() => loadEnv()).toThrow(/WEB_APP_URL/);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getJwtSecret, loadEnv, MissingEnvError } from '../../src/lib/env';

/**
 * Guards the property that makes the suite runnable at all: reading the
 * environment must never call `process.exit`. Under a test runner that would
 * kill the worker with no reported failure, so these tests assert a throw.
 *
 * `index.ts` is what turns the throw back into exit code 1, keeping a
 * misconfigured server from starting.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getJwtSecret', () => {
  it('returns the configured secret', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    expect(getJwtSecret()).toBe('a-secret');
  });

  it('throws MissingEnvError when unset', () => {
    vi.stubEnv('JWT_SECRET', '');
    expect(() => getJwtSecret()).toThrow(MissingEnvError);
  });

  it('rejects a whitespace-only secret', () => {
    vi.stubEnv('JWT_SECRET', '   ');
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET is not set/);
  });

  it('names the variable and how to fix it', () => {
    vi.stubEnv('JWT_SECRET', '');
    expect(() => getJwtSecret()).toThrow(/openssl rand -hex 32/);
  });
});

describe('loadEnv', () => {
  it('defaults the port to 3001', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('PORT', '');
    expect(loadEnv().port).toBe(3001);
  });

  it('reads an explicit port', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('PORT', '8080');
    expect(loadEnv().port).toBe(8080);
  });

  it.each(['0', '70000', 'not-a-port', '-1'])('rejects PORT=%s', (port) => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('PORT', port);
    expect(() => loadEnv()).toThrow(MissingEnvError);
  });

  it('parses CORS_ORIGIN into a trimmed list', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('CORS_ORIGIN', 'https://a.example , https://b.example');
    expect(loadEnv().corsOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('drops empty entries left by a trailing comma', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('CORS_ORIGIN', 'https://a.example,,');
    expect(loadEnv().corsOrigins).toEqual(['https://a.example']);
  });

  it('yields an empty origin list when CORS_ORIGIN is unset', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(loadEnv().corsOrigins).toEqual([]);
  });

  it('requires CORS_ORIGIN in production', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(() => loadEnv()).toThrow(MissingEnvError);
    expect(() => loadEnv()).toThrow(/CORS_ORIGIN is not set/);
  });

  it('accepts a configured CORS_ORIGIN in production', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');
    expect(loadEnv().corsOrigins).toEqual(['https://app.example.com']);
  });

  it('stays permissive outside production', () => {
    vi.stubEnv('JWT_SECRET', 'a-secret');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(loadEnv().corsOrigins).toEqual([]);
  });
});

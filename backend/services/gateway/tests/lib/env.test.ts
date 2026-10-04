import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadEnv, MissingEnvError } from '../../src/lib/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

function baseEnv(): void {
  vi.stubEnv('JWT_SECRET', 'a-secret');
  vi.stubEnv('INTERNAL_JWT_SECRET', 'an-internal-secret');
}

describe('loadEnv — CORS_ORIGIN', () => {
  it('requires CORS_ORIGIN in production', () => {
    baseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(() => loadEnv()).toThrow(MissingEnvError);
    expect(() => loadEnv()).toThrow(/CORS_ORIGIN is not set/);
  });

  it('stays permissive outside production', () => {
    baseEnv();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(loadEnv().corsOrigins).toEqual([]);
  });
});

describe('loadEnv — PORT', () => {
  it('rejects a non-numeric PORT', () => {
    baseEnv();
    vi.stubEnv('PORT', 'not-a-port');
    expect(() => loadEnv()).toThrow(MissingEnvError);
  });

  it('defaults to 3000 when unset', () => {
    baseEnv();
    vi.stubEnv('PORT', '');
    expect(loadEnv().port).toBe(3000);
  });
});

describe('loadEnv — service discovery (phase 5)', () => {
  it('defaults to env-based discovery with localhost URLs', () => {
    baseEnv();
    expect(loadEnv().serviceDiscovery).toBe('env');
    expect(loadEnv().authServiceUrl).toBe('http://localhost:3002');
    expect(loadEnv().glucoseServiceUrl).toBe('http://localhost:3001');
    expect(loadEnv().consulUrl).toBe('http://localhost:8500');
  });

  it('reads SERVICE_DISCOVERY and CONSUL_HTTP_ADDR when set', () => {
    baseEnv();
    vi.stubEnv('SERVICE_DISCOVERY', 'consul');
    vi.stubEnv('CONSUL_HTTP_ADDR', 'http://consul:8500');
    expect(loadEnv().serviceDiscovery).toBe('consul');
    expect(loadEnv().consulUrl).toBe('http://consul:8500');
  });

  it('strips a trailing slash from service URLs', () => {
    baseEnv();
    vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:3002/');
    expect(loadEnv().authServiceUrl).toBe('http://auth-service:3002');
  });
});

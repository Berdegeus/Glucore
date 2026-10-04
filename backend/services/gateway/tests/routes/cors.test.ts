import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvServiceRegistry } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { loadEnv } from '../../src/lib/env';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * DEP-07: the web calls the gateway straight from the browser, so every
 * authenticated request is preceded by a preflight. It must allow the
 * `Authorization` header for each origin in CORS_ORIGIN, and only for those.
 */

const VERCEL = 'https://glucore-web.vercel.app';
const LOCAL_DEV = 'http://localhost:5173';

let app: Express;

/** The gateway with CORS set to `corsOrigins`; an empty list is the permissive mode. */
function buildTestApp(corsOrigins: string[]): Express {
  // Preflights are answered by the CORS middleware; no request reaches a
  // service, so the registry can point at addresses nothing listens on.
  const registry = new EnvServiceRegistry({
    auth: 'http://127.0.0.1:1',
    glucose: 'http://127.0.0.1:1',
  });
  const authClient = new AuthClient(registry, TEST_INTERNAL_JWT_SECRET);
  const glucoseClient = new GlucoseClient(registry, TEST_INTERNAL_JWT_SECRET);
  return buildApp({
    corsOrigins,
    container: {
      authenticate: createAuthenticate(() => TEST_JWT_SECRET),
      registry,
      authClient,
      glucoseClient,
      registerSaga: new RegisterSaga(authClient, glucoseClient),
    },
  });
}

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  vi.stubEnv('INTERNAL_JWT_SECRET', TEST_INTERNAL_JWT_SECRET);
  // Two origins, comma-separated with a space, the way the VM's .env lists them.
  vi.stubEnv('CORS_ORIGIN', `${VERCEL}, ${LOCAL_DEV}`);

  app = buildTestApp(loadEnv().corsOrigins);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const preflight = (path: string, origin: string, method = 'PUT') =>
  request(app)
    .options(path)
    .set('Origin', origin)
    .set('Access-Control-Request-Method', method)
    .set('Access-Control-Request-Headers', 'authorization,content-type');

describe('CORS preflight', () => {
  it('reads both origins from a comma-separated CORS_ORIGIN', () => {
    expect(loadEnv().corsOrigins).toEqual([VERCEL, LOCAL_DEV]);
  });

  it.each([VERCEL, LOCAL_DEV])(
    'answers 204 for %s, echoing the origin and allowing Authorization',
    async (origin) => {
      const res = await preflight('/api/v1/preferences/dashboard', origin);

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-headers']?.toLowerCase().split(',')).toContain(
        'authorization',
      );
    },
  );

  it('allows Authorization on a clinical route too', async () => {
    const res = await preflight('/api/v1/dashboard/summary', VERCEL, 'GET');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(VERCEL);
    expect(res.headers['access-control-allow-headers']?.toLowerCase().split(',')).toContain(
      'authorization',
    );
  });

  it.each(['https://evil.example.com', 'https://glucore-web.vercel.app.evil.com'])(
    'gives the unlisted origin %s no Access-Control-Allow-Origin',
    async (origin) => {
      const res = await preflight('/api/v1/preferences/dashboard', origin);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    },
  );
});

/**
 * ACC-08, PRO-15: the browser only lets the web read `Retry-After` and
 * `X-Degraded` when the response names them in `Access-Control-Expose-Headers`.
 * `GET /api/v1/me` without a token answers 401 from the gateway itself, which
 * is enough to observe the CORS headers of a real (non-preflight) response.
 */
describe('CORS exposed response headers', () => {
  const crossOriginGet = (target: Express, origin: string) =>
    request(target).get('/api/v1/me').set('Origin', origin);

  const exposedHeaders = (header: string | undefined) =>
    (header ?? '').split(',').map((name) => name.trim().toLowerCase());

  it.each([VERCEL, LOCAL_DEV])('exposes Retry-After and X-Degraded to the listed origin %s', async (origin) => {
    const res = await crossOriginGet(app, origin);

    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(exposedHeaders(res.headers['access-control-expose-headers'])).toEqual(
      expect.arrayContaining(['retry-after', 'x-degraded']),
    );
  });

  it('exposes them in the permissive mode, when CORS_ORIGIN is empty', async () => {
    const res = await crossOriginGet(buildTestApp([]), 'https://any.example.com');

    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(exposedHeaders(res.headers['access-control-expose-headers'])).toEqual(
      expect.arrayContaining(['retry-after', 'x-degraded']),
    );
  });

  it('still gives an unlisted origin no Access-Control-Allow-Origin', async () => {
    const res = await crossOriginGet(app, 'https://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

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

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  vi.stubEnv('INTERNAL_JWT_SECRET', TEST_INTERNAL_JWT_SECRET);
  // Two origins, comma-separated with a space, the way the VM's .env lists them.
  vi.stubEnv('CORS_ORIGIN', `${VERCEL}, ${LOCAL_DEV}`);

  // Preflights are answered by the CORS middleware; no request reaches a
  // service, so the registry can point at addresses nothing listens on.
  const registry = new EnvServiceRegistry({
    auth: 'http://127.0.0.1:1',
    glucose: 'http://127.0.0.1:1',
  });
  const authClient = new AuthClient(registry, TEST_INTERNAL_JWT_SECRET);
  const glucoseClient = new GlucoseClient(registry, TEST_INTERNAL_JWT_SECRET);
  app = buildApp({
    corsOrigins: loadEnv().corsOrigins,
    container: {
      authenticate: createAuthenticate(() => TEST_JWT_SECRET),
      registry,
      authClient,
      glucoseClient,
      registerSaga: new RegisterSaga(authClient, glucoseClient),
    },
  });
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

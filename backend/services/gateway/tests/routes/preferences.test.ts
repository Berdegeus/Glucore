import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, signAccessToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { RegisterProfessionalSaga } from '../../src/modules/registerProfessional/registerProfessional.saga';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * LAY-07/08 at the gateway: `/api/v1/preferences` belongs to auth-service,
 * while the clinical prefixes keep going to glucose-service.
 */

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;

beforeAll(async () => {
  authFake = await startFakeDownstream();
  glucoseFake = await startFakeDownstream();

  const registry = new EnvServiceRegistry({ auth: authFake.url, glucose: glucoseFake.url });
  const authClient = new AuthClient(registry, TEST_INTERNAL_JWT_SECRET);
  const glucoseClient = new GlucoseClient(registry, TEST_INTERNAL_JWT_SECRET);
  app = buildApp({
    container: {
      authenticate: createAuthenticate(() => TEST_JWT_SECRET),
      registry,
      authClient,
      glucoseClient,
      registerSaga: new RegisterSaga(authClient, glucoseClient),
      registerProfessionalSaga: new RegisterProfessionalSaga(authClient, glucoseClient),
    },
  });
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

const BEARER = `Bearer ${signAccessToken({ sub: 'user-1', role: 'PATIENT' }, TEST_JWT_SECRET)}`;
const LAYOUT = { widgets: [{ id: 'kpi-tir', size: 'M' }] };

describe('/api/v1/preferences', () => {
  it.each(['get', 'put', 'delete'] as const)(
    '%s without a token answers 401 at the gateway and reaches no service',
    async (method) => {
      const authBefore = authFake.requests.length;
      const glucoseBefore = glucoseFake.requests.length;

      const res = await request(app)[method]('/api/v1/preferences/dashboard').send(LAYOUT);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
      expect(authFake.requests.length).toBe(authBefore);
      expect(glucoseFake.requests.length).toBe(glucoseBefore);
    },
  );

  it('rejects a token signed with the wrong secret', async () => {
    const authBefore = authFake.requests.length;
    const forged = signAccessToken({ sub: 'user-1', role: 'PATIENT' }, 'not-the-secret');
    const res = await request(app)
      .get('/api/v1/preferences/dashboard')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(authFake.requests.length).toBe(authBefore);
  });

  it('forwards PUT to auth-service with the path rewritten, the body intact and the token', async () => {
    const glucoseBefore = glucoseFake.requests.length;

    const res = await request(app)
      .put('/api/v1/preferences/dashboard')
      .set('Authorization', BEARER)
      .send(LAYOUT);

    expect(res.status).toBe(200);
    expect(authFake.requests.at(-1)).toMatchObject({
      method: 'PUT',
      path: '/preferences/dashboard',
      body: LAYOUT,
    });
    expect(authFake.requests.at(-1)?.headers.authorization).toBe(BEARER);
    expect(glucoseFake.requests.length).toBe(glucoseBefore);
  });

  it.each(['GET', 'DELETE'])('forwards %s to auth-service', async (method) => {
    const glucoseBefore = glucoseFake.requests.length;

    const res = await request(app)
      [method === 'GET' ? 'get' : 'delete']('/api/v1/preferences/dashboard')
      .set('Authorization', BEARER);

    expect(res.status).toBe(200);
    expect(authFake.requests.at(-1)).toMatchObject({ method, path: '/preferences/dashboard' });
    expect(glucoseFake.requests.length).toBe(glucoseBefore);
  });
});

describe('clinical prefixes', () => {
  it.each(['readings', 'carbs', 'insulin', 'alerts', 'settings', 'dashboard'])(
    'still proxies /api/v1/%s to glucose-service, not auth-service',
    async (prefix) => {
      const authBefore = authFake.requests.length;

      const res = await request(app).get(`/api/v1/${prefix}`).set('Authorization', BEARER);

      expect(res.status).toBe(200);
      expect(glucoseFake.requests.at(-1)).toMatchObject({ path: `/${prefix}` });
      expect(authFake.requests.length).toBe(authBefore);
    },
  );
});

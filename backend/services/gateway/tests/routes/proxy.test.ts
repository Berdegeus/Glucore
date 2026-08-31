import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, signAccessToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * The gateway's first real moment of truth: does a request to `/api/v1/<x>`
 * actually reach the right service, with its body intact?
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
    },
  });
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

function bearerFor(userId: string) {
  return `Bearer ${signAccessToken({ sub: userId, role: 'PATIENT' }, TEST_JWT_SECRET)}`;
}

describe('POST /api/v1/auth/*', () => {
  it('rewrites the path and forwards the body, with no authentication required', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'x' });

    expect(res.status).toBe(200);
    expect(authFake.requests.at(-1)).toMatchObject({
      path: '/auth/login',
      body: { email: 'a@b.com', password: 'x' },
    });
  });
});

describe('/api/v1/{readings,carbs,insulin,alerts,settings}', () => {
  it('rejects a request with no token before it ever reaches the downstream', async () => {
    const before = glucoseFake.requests.length;
    const res = await request(app).get('/api/v1/readings');
    expect(res.status).toBe(401);
    expect(glucoseFake.requests.length).toBe(before);
  });

  it.each(['readings', 'carbs', 'insulin', 'alerts', 'settings'])(
    'proxies GET /api/v1/%s to glucose-service with the path rewritten',
    async (prefix) => {
      const res = await request(app).get(`/api/v1/${prefix}`).set('Authorization', bearerFor('user-1'));
      expect(res.status).toBe(200);
      expect(glucoseFake.requests.at(-1)).toMatchObject({ path: `/${prefix}` });
    },
  );

  it('forwards a POST body downstream unchanged', async () => {
    const res = await request(app)
      .post('/api/v1/carbs/item')
      .set('Authorization', bearerFor('user-1'))
      .send({ grams: 45, description: 'almoço' });

    expect(res.status).toBe(200);
    expect(glucoseFake.requests.at(-1)).toMatchObject({
      path: '/carbs/item',
      body: { grams: 45, description: 'almoço' },
    });
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = signAccessToken({ sub: 'user-1', role: 'PATIENT' }, 'not-the-secret');
    const res = await request(app).get('/api/v1/readings').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

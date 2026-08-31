import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, signAccessToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let glucoseGetShouldFail: boolean;
let glucoseUpdateShouldFail: boolean;

const bearer = () => `Bearer ${signAccessToken({ sub: 'user-1', role: 'PATIENT' }, TEST_JWT_SECRET)}`;

beforeAll(async () => {
  glucoseGetShouldFail = false;
  glucoseUpdateShouldFail = false;

  authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.get('/internal/accounts/me', (_req, res) => {
      res.json({ id: 'user-1', email: 'a@b.com', fullName: 'Fulano' });
    });
    fakeApp.put('/internal/accounts/me', (_req, res) => res.json({ message: 'Profile updated.' }));
  });

  glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.get('/internal/patients/me', (_req, res) => {
      if (glucoseGetShouldFail) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      res.json({ targetRangeMin: 90, targetRangeMax: 170 });
    });
    fakeApp.put('/internal/patients/me', (_req, res) => {
      if (glucoseUpdateShouldFail) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      res.json({ targetRangeMin: 90, targetRangeMax: 170 });
    });
  });

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

afterEach(() => {
  glucoseGetShouldFail = false;
  glucoseUpdateShouldFail = false;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe('GET /api/v1/me', () => {
  it('rejects a request with no token', async () => {
    expect((await request(app).get('/api/v1/me')).status).toBe(401);
  });

  it('composes the account and patient blocks', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'a@b.com',
      patient: { targetRangeMin: 90, targetRangeMax: 170 },
    });
  });

  it('degrades gracefully to default patient fields when the glucose leg fails', async () => {
    glucoseGetShouldFail = true;
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBe('patient-profile');
    expect(res.body.patient).toEqual({
      birthDate: null,
      diabetesType: null,
      weightKg: null,
      targetRangeMin: 80,
      targetRangeMax: 180,
    });
  });
});

describe('PUT /api/v1/me', () => {
  it('updates both legs when the body touches both', async () => {
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', bearer())
      .send({ fullName: 'Novo Nome', targetRangeMin: 75 });
    expect(res.status).toBe(200);
  });

  it('answers 502 PARTIAL_UPDATE when the account leg succeeds but the patient leg fails', async () => {
    glucoseUpdateShouldFail = true;
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', bearer())
      .send({ targetRangeMin: 75 });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('PARTIAL_UPDATE');
  });
});

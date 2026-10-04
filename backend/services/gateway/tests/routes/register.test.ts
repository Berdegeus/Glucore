import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * The saga is exercised end to end against real HTTP fakes rather than mocked
 * clients: the request log on each fake proves both which calls were made and
 * in what order, which is the actual claim the saga makes about itself.
 */

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let glucoseShouldFail: boolean;

beforeAll(async () => {
  glucoseShouldFail = false;

  authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.post('/internal/accounts', (req, res) => {
      if (req.body.email === 'taken@example.com') {
        res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
        return;
      }
      res.status(201).json({ userId: 'new-user-id', token: 'a-token' });
    });
    fakeApp.delete('/internal/accounts/:id', (_req, res) => res.status(204).send());
  });

  glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.post('/internal/patients', (_req, res) => {
      if (glucoseShouldFail) {
        res.status(500).json({ error: 'boom' });
        return;
      }
      res.status(201).json({ targetRangeMin: 80, targetRangeMax: 180 });
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
  glucoseShouldFail = false;
  authFake.requests.length = 0;
  glucoseFake.requests.length = 0;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

const register = (body: Record<string, unknown>) => request(app).post('/api/v1/auth/register').send(body);

describe('POST /api/v1/auth/register', () => {
  it('creates the account and the patient, answering 201 with userId and token', async () => {
    const res = await register({ email: 'a@b.com', password: 'x', fullName: 'Novo', targetRangeMin: 70 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ userId: 'new-user-id', token: 'a-token' });
    expect(glucoseFake.requests.at(-1)).toMatchObject({ path: '/internal/patients' });
  });

  it('propagates 409 EMAIL_TAKEN without ever calling glucose-service', async () => {
    const res = await register({ email: 'taken@example.com', password: 'x', fullName: 'Novo' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
    expect(glucoseFake.requests).toHaveLength(0);
  });

  it('compensates exactly once when the glucose leg fails, and answers an error', async () => {
    glucoseShouldFail = true;
    const res = await register({ email: 'a@b.com', password: 'x', fullName: 'Novo' });

    expect(res.status).toBeGreaterThanOrEqual(500);
    const compensations = authFake.requests.filter((r) => r.method === 'DELETE');
    expect(compensations).toHaveLength(1);
    expect(compensations[0].path).toBe('/internal/accounts/new-user-id');
  });
});

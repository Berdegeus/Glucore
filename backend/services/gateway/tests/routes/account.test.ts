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

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;

const bearer = () => `Bearer ${signAccessToken({ sub: 'user-1', role: 'PATIENT' }, TEST_JWT_SECRET)}`;

beforeAll(async () => {
  authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.delete('/internal/accounts/:id', (_req, res) => res.status(204).send());
  });
  glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.delete('/internal/patients/:id', (_req, res) => res.status(204).send());
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

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe('DELETE /api/v1/account', () => {
  it('rejects a request with no token', async () => {
    expect((await request(app).delete('/api/v1/account')).status).toBe(401);
  });

  it('deletes glucose data before the account, and answers 204', async () => {
    const res = await request(app).delete('/api/v1/account').set('Authorization', bearer());
    expect(res.status).toBe(204);
    expect(glucoseFake.requests.at(-1)).toMatchObject({ method: 'DELETE', path: '/internal/patients/user-1' });
    expect(authFake.requests.at(-1)).toMatchObject({ method: 'DELETE', path: '/internal/accounts/user-1' });
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, signAccessToken, type UserRoleName } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { RegisterProfessionalSaga } from '../../src/modules/registerProfessional/registerProfessional.saga';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * One call log shared by both fakes, so "clinical first, identity second" is
 * asserted as an ordering across the two services rather than inferred from
 * each service's own log.
 */

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let calls: string[] = [];
let clinicalDeleteFails = false;

const bearer = (role: UserRoleName) => `Bearer ${signAccessToken({ sub: 'user-1', role }, TEST_JWT_SECRET)}`;
const deleteAccount = (role: UserRoleName) => request(app).delete('/api/v1/account').set('Authorization', bearer(role));

beforeAll(async () => {
  authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.delete('/internal/accounts/:id', (req, res) => {
      calls.push(`auth DELETE /internal/accounts/${req.params.id}`);
      res.status(204).send();
    });
  });
  glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.delete('/internal/patients/:id', (req, res) => {
      calls.push(`glucose DELETE /internal/patients/${req.params.id}`);
      res.status(204).send();
    });
    fakeApp.delete('/internal/professionals/:id', (req, res) => {
      calls.push(`glucose DELETE /internal/professionals/${req.params.id}`);
      if (clinicalDeleteFails) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      res.status(204).send();
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
      registerProfessionalSaga: new RegisterProfessionalSaga(authClient, glucoseClient),
    },
  });
});

afterEach(() => {
  calls = [];
  clinicalDeleteFails = false;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe('DELETE /api/v1/account by role', () => {
  it.each<[UserRoleName, string[]]>([
    ['PATIENT', ['glucose DELETE /internal/patients/user-1', 'auth DELETE /internal/accounts/user-1']],
    ['HEALTH_PROFESSIONAL', ['glucose DELETE /internal/professionals/user-1', 'auth DELETE /internal/accounts/user-1']],
    ['ADMINISTRATOR', ['auth DELETE /internal/accounts/user-1']],
  ])('%s: calls exactly the expected deletes, clinical profile before the account, and answers 204', async (role, expected) => {
    const res = await deleteAccount(role);

    expect(res.status).toBe(204);
    expect(calls).toEqual(expected);
  });

  it('is idempotent: a repeated delete for a professional answers 204 again', async () => {
    expect((await deleteAccount('HEALTH_PROFESSIONAL')).status).toBe(204);
    expect((await deleteAccount('HEALTH_PROFESSIONAL')).status).toBe(204);
    expect(calls.filter((c) => c.startsWith('auth'))).toHaveLength(2);
  });

  it('keeps the account when the clinical delete fails, so identity is never removed before the data', async () => {
    clinicalDeleteFails = true;
    const res = await deleteAccount('HEALTH_PROFESSIONAL');

    expect(res.status).toBe(503);
    expect(calls).toEqual(['glucose DELETE /internal/professionals/user-1']);
  });
});

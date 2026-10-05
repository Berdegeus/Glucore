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
 * `/me` composed by role. The glucose fake records every request, and
 * `/internal/patients/*` is the assertion that matters: glucose-service
 * creates a `Patient` row on `GET /internal/patients/me`, so any hit there
 * for a professional or an administrator is a bug with a database side effect.
 */

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let professionalLegFails = false;
let accountLegFails = false;

const PROFESSIONAL = { userId: 'user-1', licenseNumber: 'CRM-123456', specialty: 'Endocrinologia' };

const bearer = (role: UserRoleName) => `Bearer ${signAccessToken({ sub: 'user-1', role }, TEST_JWT_SECRET)}`;
const patientCalls = () => glucoseFake.requests.filter((r) => r.path.startsWith('/internal/patients'));

beforeAll(async () => {
  authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.get('/internal/accounts/me', (_req, res) => {
      if (accountLegFails) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      res.json({ id: 'user-1', email: 'a@b.com', fullName: 'Fulano' });
    });
    fakeApp.put('/internal/accounts/me', (_req, res) => res.json({ message: 'Profile updated.' }));
  });

  glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.get('/internal/professionals/me', (_req, res) => {
      if (professionalLegFails) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      res.json(PROFESSIONAL);
    });
    fakeApp.get('/internal/patients/me', (_req, res) => res.json({ targetRangeMin: 90, targetRangeMax: 170 }));
    fakeApp.put('/internal/patients/me', (_req, res) => res.json({ targetRangeMin: 75, targetRangeMax: 170 }));
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
  professionalLegFails = false;
  accountLegFails = false;
  authFake.requests.length = 0;
  glucoseFake.requests.length = 0;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe('GET /api/v1/me by role', () => {
  it('composes the account and the professional block for a HEALTH_PROFESSIONAL, never touching patients', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('HEALTH_PROFESSIONAL'));

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBeUndefined();
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com', fullName: 'Fulano', professional: PROFESSIONAL });
    expect(res.body.patient).toBeUndefined();
    expect(patientCalls()).toHaveLength(0);
  });

  it('degrades the professional leg with X-Degraded and a null block when glucose fails', async () => {
    professionalLegFails = true;
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('HEALTH_PROFESSIONAL'));

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBe('professional-profile');
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com', fullName: 'Fulano', professional: null });
    expect(patientCalls()).toHaveLength(0);
  });

  it('answers the account alone for an ADMINISTRATOR, without calling glucose at all', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('ADMINISTRATOR'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com', fullName: 'Fulano' });
    expect(glucoseFake.requests).toHaveLength(0);
  });

  it('keeps the patient composition for a PATIENT and does not ask for a professional profile', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('PATIENT'));

    expect(res.status).toBe(200);
    expect(res.body.patient).toEqual({ targetRangeMin: 90, targetRangeMax: 170 });
    expect(res.body.professional).toBeUndefined();
    expect(glucoseFake.requests.map((r) => r.path)).toEqual(['/internal/patients/me']);
  });

  it('fails the whole request when the account leg fails, even though the professional leg answered', async () => {
    accountLegFails = true;
    const res = await request(app).get('/api/v1/me').set('Authorization', bearer('HEALTH_PROFESSIONAL'));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.professional).toBeUndefined();
  });
});

describe('PUT /api/v1/me by role', () => {
  it.each<UserRoleName>(['HEALTH_PROFESSIONAL', 'ADMINISTRATOR'])(
    'updates only the account for %s and ignores patient-block fields',
    async (role) => {
      const res = await request(app)
        .put('/api/v1/me')
        .set('Authorization', bearer(role))
        .send({ fullName: 'Novo Nome', targetRangeMin: 75, weightKg: 70 });

      expect(res.status).toBe(200);
      expect(authFake.requests.at(-1)).toMatchObject({ method: 'PUT', path: '/internal/accounts/me', body: { fullName: 'Novo Nome' } });
      expect(authFake.requests.at(-1)!.body).not.toHaveProperty('targetRangeMin');
      expect(glucoseFake.requests).toHaveLength(0);
    },
  );

  it('still sends the patient block to glucose for a PATIENT', async () => {
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', bearer('PATIENT'))
      .send({ fullName: 'Novo Nome', targetRangeMin: 75 });

    expect(res.status).toBe(200);
    expect(glucoseFake.requests.at(-1)).toMatchObject({ method: 'PUT', path: '/internal/patients/me', body: { targetRangeMin: 75 } });
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, verifyInternalToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { RegisterProfessionalSaga } from '../../src/modules/registerProfessional/registerProfessional.saga';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * Real HTTP fakes for both services, as in `register.test.ts`: the request log
 * on each fake is the evidence of which calls were made, with which body.
 */

let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;

const body = {
  email: 'pro@example.com',
  password: 'Str0ng!pass',
  fullName: 'Dra. Ana',
  phone: '11999990000',
  licenseNumber: 'CRM-123456',
  specialty: 'Endocrinologia',
};

/** A fresh app means a fresh rate-limit window, so the 429 test cannot starve the others. */
function buildTestApp(): Express {
  const registry = new EnvServiceRegistry({ auth: authFake.url, glucose: glucoseFake.url });
  const authClient = new AuthClient(registry, TEST_INTERNAL_JWT_SECRET);
  const glucoseClient = new GlucoseClient(registry, TEST_INTERNAL_JWT_SECRET);
  return buildApp({
    container: {
      authenticate: createAuthenticate(() => TEST_JWT_SECRET),
      registry,
      authClient,
      glucoseClient,
      registerSaga: new RegisterSaga(authClient, glucoseClient),
      registerProfessionalSaga: new RegisterProfessionalSaga(authClient, glucoseClient),
    },
  });
}

const registerProfessional = (app: Express, payload: Record<string, unknown> = body) =>
  request(app).post('/api/v1/auth/register/professional').send(payload);

let app: Express;

beforeAll(async () => {
  authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.post('/internal/accounts/professional', (req, res) => {
      if (req.body.email === 'taken@example.com') {
        res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
        return;
      }
      if (req.body.password === 'weak') {
        res.status(400).json({ error: 'Weak password', code: 'WEAK_PASSWORD' });
        return;
      }
      res.status(201).json({ userId: 'pro-1', token: 'a-token' });
    });
    fakeApp.post('/internal/accounts', (_req, res) => res.status(201).json({ userId: 'patient-1', token: 'p-token' }));
    fakeApp.delete('/internal/accounts/:id', (_req, res) => res.status(204).send());
  });

  glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.post('/internal/professionals', (req, res) => {
      // Mirrors the real service: blank or missing fields are a 400.
      if (typeof req.body.licenseNumber !== 'string' || typeof req.body.specialty !== 'string') {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      res.status(201).json({ userId: 'pro-1', ...req.body });
    });
    fakeApp.post('/internal/patients', (_req, res) => res.status(201).json({ targetRangeMin: 80 }));
  });

  app = buildTestApp();
});

afterEach(() => {
  authFake.requests.length = 0;
  glucoseFake.requests.length = 0;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe('POST /api/v1/auth/register/professional', () => {
  it('creates the account and the professional profile, answering 201 with userId and token, without a bearer token', async () => {
    const res = await registerProfessional(app);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ userId: 'pro-1', token: 'a-token' });

    expect(authFake.requests.at(-1)).toMatchObject({
      path: '/internal/accounts/professional',
      body: { email: body.email, password: body.password, fullName: body.fullName, phone: body.phone },
    });
    const profileCall = glucoseFake.requests.at(-1)!;
    expect(profileCall).toMatchObject({
      path: '/internal/professionals',
      body: { licenseNumber: body.licenseNumber, specialty: body.specialty },
    });
    expect(verifyInternalToken(profileCall.headers['x-internal-token'] as string, TEST_INTERNAL_JWT_SECRET)).toEqual({
      sub: 'pro-1',
      role: 'HEALTH_PROFESSIONAL',
    });
  });

  it('repasses WEAK_PASSWORD from auth-service with its status and code, and never calls glucose', async () => {
    const res = await registerProfessional(app, { ...body, password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
    expect(glucoseFake.requests).toHaveLength(0);
  });

  it('repasses EMAIL_TAKEN from auth-service with its status and code, and never calls glucose', async () => {
    const res = await registerProfessional(app, { ...body, email: 'taken@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
    expect(glucoseFake.requests).toHaveLength(0);
  });

  it('surfaces a missing professional field as the service 400 and compensates by deleting the account', async () => {
    const { licenseNumber: _omitted, ...withoutLicense } = body;
    const res = await registerProfessional(app, withoutLicense);

    expect(res.status).toBe(400);
    const deletes = authFake.requests.filter((r) => r.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].path).toBe('/internal/accounts/pro-1');
  });

  it('drops a role and any other unknown field from the body before any downstream call', async () => {
    const res = await registerProfessional(app, { ...body, role: 'ADMINISTRATOR', userId: 'someone-else', isAdmin: true });

    expect(res.status).toBe(201);
    const accountBody = authFake.requests.find((r) => r.path === '/internal/accounts/professional')!.body as Record<string, unknown>;
    expect(Object.keys(accountBody).sort()).toEqual(['email', 'fullName', 'password', 'phone']);
    const profileBody = glucoseFake.requests.find((r) => r.path === '/internal/professionals')!.body as Record<string, unknown>;
    expect(Object.keys(profileBody).sort()).toEqual(['licenseNumber', 'specialty']);
  });

  it('is routed to the professional saga and never to the patient one, while the patient register is unchanged', async () => {
    await registerProfessional(app);
    expect(authFake.requests.map((r) => r.path)).toEqual(['/internal/accounts/professional']);
    expect(glucoseFake.requests.map((r) => r.path)).toEqual(['/internal/professionals']);

    authFake.requests.length = 0;
    glucoseFake.requests.length = 0;
    const patient = await request(app).post('/api/v1/auth/register').send({ email: 'p@b.com', password: 'x', fullName: 'Pac' });
    expect(patient.status).toBe(201);
    expect(authFake.requests.map((r) => r.path)).toEqual(['/internal/accounts']);
    expect(glucoseFake.requests.map((r) => r.path)).toEqual(['/internal/patients']);
  });

  it('allows 20 requests per IP in the window and answers 429 on the 21st', async () => {
    const limited = buildTestApp();

    for (let i = 1; i <= 20; i += 1) {
      expect((await registerProfessional(limited)).status, `request ${i}`).toBe(201);
    }
    const res = await registerProfessional(limited);

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});

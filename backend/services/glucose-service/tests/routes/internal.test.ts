import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signInternalToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * `/internal/*` is the gateway's only path into this service's patient data.
 * `toPatientDto` and `ensure` predate these routes (see their own comments);
 * this file is their first real exercise.
 */

let app: Express;

function internalToken(sub: string, role: 'PATIENT' | 'HEALTH_PROFESSIONAL' | 'ADMINISTRATOR' = 'PATIENT') {
  return signInternalToken({ sub, role }, TEST_INTERNAL_JWT_SECRET);
}

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await disconnect();
});

describe('POST /internal/patients', () => {
  it('rejects a request with no internal token', async () => {
    const res = await request(app).post('/internal/patients').send({});
    expect(res.status).toBe(401);
  });

  it('creates the patient and its alert thresholds together', async () => {
    const userId = randomUUID();
    const res = await request(app)
      .post('/internal/patients')
      .set('x-internal-token', internalToken(userId))
      .send({ targetRangeMin: 70, targetRangeMax: 160 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      birthDate: null,
      diabetesType: null,
      weightKg: null,
      targetRangeMin: 70,
      targetRangeMax: 160,
    });

    const config = await prisma.alertThresholdConfig.findUnique({ where: { patientId: userId } });
    expect(config).toMatchObject({ lowGlucoseMgDl: 70, highGlucoseMgDl: 160 });
  });

  it('defaults the target range to 80/180 when absent', async () => {
    const userId = randomUUID();
    const res = await request(app)
      .post('/internal/patients')
      .set('x-internal-token', internalToken(userId))
      .send({});
    expect(res.body).toMatchObject({ targetRangeMin: 80, targetRangeMax: 180 });
  });
});

describe('GET /internal/patients/me', () => {
  it('rejects a request with no internal token', async () => {
    const res = await request(app).get('/internal/patients/me');
    expect(res.status).toBe(401);
  });

  it('ignores x-user-id and resolves identity from the internal token', async () => {
    const owner = await signedInPatient({ targetRangeMin: 90, targetRangeMax: 170 });
    const someoneElse = await signedInPatient();

    const res = await request(app)
      .get('/internal/patients/me')
      .set('x-internal-token', internalToken(owner.userId))
      // A forged header claiming to be someone else must have no effect.
      .set('x-user-id', someoneElse.userId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ targetRangeMin: 90, targetRangeMax: 170 });
  });

  it('creates the row lazily for a token with no patient yet', async () => {
    const userId = randomUUID();
    const res = await request(app).get('/internal/patients/me').set('x-internal-token', internalToken(userId));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ targetRangeMin: 80, targetRangeMax: 180 });
  });
});

describe('PUT /internal/patients/me', () => {
  it('updates fields and re-syncs the alert thresholds when the target range moves', async () => {
    const patient = await signedInPatient();

    const res = await request(app)
      .put('/internal/patients/me')
      .set('x-internal-token', internalToken(patient.userId))
      .send({ weightKg: 68.5, targetRangeMin: 75, targetRangeMax: 165 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ weightKg: 68.5, targetRangeMin: 75, targetRangeMax: 165 });

    const config = await prisma.alertThresholdConfig.findUnique({ where: { patientId: patient.userId } });
    expect(config).toMatchObject({ lowGlucoseMgDl: 75, highGlucoseMgDl: 165 });
  });

  it('rejects an inverted target range', async () => {
    const patient = await signedInPatient();
    const res = await request(app)
      .put('/internal/patients/me')
      .set('x-internal-token', internalToken(patient.userId))
      .send({ targetRangeMin: 180, targetRangeMax: 80 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /internal/patients/:id', () => {
  it('rejects a request with no internal token, regardless of x-user-id', async () => {
    const patient = await signedInPatient();
    const res = await request(app).delete(`/internal/patients/${patient.userId}`).set('x-user-id', patient.userId);
    expect(res.status).toBe(401);
  });

  it('deletes the patient and answers 204', async () => {
    const patient = await signedInPatient();
    const res = await request(app)
      .delete(`/internal/patients/${patient.userId}`)
      .set('x-internal-token', internalToken('gateway'));
    expect(res.status).toBe(204);
    expect(await prisma.patient.findUnique({ where: { userId: patient.userId } })).toBeNull();
  });

  it('is idempotent: deleting an already-gone id still answers 204', async () => {
    const patient = await signedInPatient();
    await request(app).delete(`/internal/patients/${patient.userId}`).set('x-internal-token', internalToken('gateway'));
    const res = await request(app)
      .delete(`/internal/patients/${patient.userId}`)
      .set('x-internal-token', internalToken('gateway'));
    expect(res.status).toBe(204);
  });
});

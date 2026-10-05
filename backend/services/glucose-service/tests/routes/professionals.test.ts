import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signInternalToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * `/internal/professionals`: REG-01 and REG-04 (the profile leg of the
 * registration saga, retried and compensated by the gateway), CON-11 (the
 * profile's grants go with it).
 */

type Role = 'PATIENT' | 'HEALTH_PROFESSIONAL' | 'ADMINISTRATOR';

let app: Express;

const token = (sub: string, role: Role = 'HEALTH_PROFESSIONAL') =>
  signInternalToken({ sub, role }, TEST_INTERNAL_JWT_SECRET);

const PROFILE = { licenseNumber: 'CRM-SP 123456', specialty: 'Endocrinologia' };

const createProfile = (userId: string, body: Record<string, unknown> = PROFILE, role?: Role) =>
  request(app).post('/internal/professionals').set('x-internal-token', token(userId, role)).send(body);

beforeAll(() => {
  app = buildApp();
});

beforeEach(truncateAll);

afterAll(async () => {
  await disconnect();
});

describe('POST /internal/professionals', () => {
  it('rejects a request with no internal token', async () => {
    const res = await request(app).post('/internal/professionals').send(PROFILE);
    expect(res.status).toBe(401);
    expect(await prisma.healthProfessional.count()).toBe(0);
  });

  it('creates the profile under the token sub, trimmed, and answers 201 (REG-01)', async () => {
    const userId = randomUUID();
    const res = await createProfile(userId, { licenseNumber: '  CRM-SP 123456 ', specialty: ' Endocrinologia ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ userId, ...PROFILE });
    expect(await prisma.healthProfessional.findUnique({ where: { userId } })).toEqual({ userId, ...PROFILE });
  });

  it('takes the identity from the token, not from a userId in the body', async () => {
    const userId = randomUUID();
    const res = await createProfile(userId, { ...PROFILE, userId: randomUUID() });

    expect(res.body.userId).toBe(userId);
    expect(await prisma.healthProfessional.count()).toBe(1);
  });

  it('is idempotent: a repeat answers the stored profile and changes nothing (REG-04)', async () => {
    const userId = randomUUID();
    await createProfile(userId);
    const again = await createProfile(userId, { licenseNumber: 'OUTRO 1', specialty: 'Outra' });

    expect(again.status).toBe(201);
    expect(again.body).toEqual({ userId, ...PROFILE });
    expect(await prisma.healthProfessional.count()).toBe(1);
  });

  it.each<Role>(['PATIENT', 'ADMINISTRATOR'])('refuses a %s identity with 403 and creates nothing', async (role) => {
    const res = await createProfile(randomUUID(), PROFILE, role);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
    expect(await prisma.healthProfessional.count()).toBe(0);
  });

  it.each([
    ['a blank license number', { ...PROFILE, licenseNumber: '   ' }],
    ['a license number over 40 characters', { ...PROFILE, licenseNumber: 'a'.repeat(41) }],
    ['a specialty over 80 characters', { ...PROFILE, specialty: 'a'.repeat(81) }],
    ['no body', {}],
  ])('answers 400 for %s and creates nothing (REG-05)', async (_label, body) => {
    const res = await createProfile(randomUUID(), body);
    expect(res.status).toBe(400);
    expect(await prisma.healthProfessional.count()).toBe(0);
  });

  it('does not make the professional a patient', async () => {
    await createProfile(randomUUID());
    expect(await prisma.patient.count()).toBe(0);
  });
});

describe('GET /internal/professionals/me', () => {
  it('rejects a request with no internal token', async () => {
    expect((await request(app).get('/internal/professionals/me')).status).toBe(401);
  });

  it('answers the registration number and specialty of the token identity, ignoring x-user-id', async () => {
    const owner = randomUUID();
    const other = randomUUID();
    await createProfile(owner);
    await createProfile(other, { licenseNumber: 'OUTRO 1', specialty: 'Outra' });

    const res = await request(app)
      .get('/internal/professionals/me')
      .set('x-internal-token', token(owner))
      .set('x-user-id', other);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: owner, ...PROFILE });
  });

  it('answers 404 when the identity has no profile, and does not create one or a patient', async () => {
    const res = await request(app).get('/internal/professionals/me').set('x-internal-token', token(randomUUID()));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Professional profile not found');
    expect(await prisma.healthProfessional.count()).toBe(0);
    expect(await prisma.patient.count()).toBe(0);
  });

  it('refuses a PATIENT identity with 403', async () => {
    const res = await request(app)
      .get('/internal/professionals/me')
      .set('x-internal-token', token(randomUUID(), 'PATIENT'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });
});

describe('DELETE /internal/professionals/:id', () => {
  const remove = (id: string, withToken = true) => {
    const call = request(app).delete(`/internal/professionals/${id}`);
    return withToken ? call.set('x-internal-token', token('gateway', 'PATIENT')) : call;
  };

  it('rejects a request with no internal token', async () => {
    const userId = randomUUID();
    await createProfile(userId);

    expect((await remove(userId, false)).status).toBe(401);
    expect(await prisma.healthProfessional.count()).toBe(1);
  });

  it('removes the profile and answers 204', async () => {
    const userId = randomUUID();
    await createProfile(userId);

    expect((await remove(userId)).status).toBe(204);
    expect(await prisma.healthProfessional.findUnique({ where: { userId } })).toBeNull();
  });

  it('is idempotent: deleting a profile that is already gone still answers 204', async () => {
    const userId = randomUUID();
    await createProfile(userId);
    await remove(userId);

    expect((await remove(userId)).status).toBe(204);
    expect((await remove(randomUUID())).status).toBe(204);
  });

  it('removes the access grants of the professional and keeps the patient and the other grants (CON-11)', async () => {
    const professional = randomUUID();
    const otherProfessional = randomUUID();
    await createProfile(professional);
    await createProfile(otherProfessional);
    const patient = await signedInPatient();
    const grant = (healthProfessionalId: string) =>
      prisma.dashboardAccessGrant.create({
        data: { patientId: patient.userId, healthProfessionalId, permissionLevel: 'READ' },
      });
    await grant(professional);
    const kept = await grant(otherProfessional);

    await remove(professional);

    expect(await prisma.dashboardAccessGrant.findMany({ select: { id: true } })).toEqual([{ id: kept.id }]);
    expect(await prisma.patient.count()).toBe(1);
  });
});

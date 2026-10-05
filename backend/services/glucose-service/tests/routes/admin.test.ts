import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signInternalToken, type UserRoleName } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * `GET /internal/admin/stats` end to end (ADM-03, ADM-05): an administrator
 * identity gets counts only, any other role is `403 FORBIDDEN_ROLE`, no internal
 * token is `401`.
 */

let app: Express;

const asRole = (role: UserRoleName) => ({
  'x-internal-token': signInternalToken({ sub: randomUUID(), role }, TEST_INTERNAL_JWT_SECRET),
});

const stats = (query = '') => request(app).get(`/internal/admin/stats${query}`);

beforeAll(() => {
  app = buildApp();
});

beforeEach(truncateAll);

afterAll(async () => {
  await disconnect();
});

describe('GET /internal/admin/stats — access', () => {
  it('answers 200 to an administrator identity', async () => {
    expect((await stats().set(asRole('ADMINISTRATOR'))).status).toBe(200);
  });

  it.each(['PATIENT', 'HEALTH_PROFESSIONAL'] as const)(
    'answers 403 FORBIDDEN_ROLE to a %s identity',
    async (role) => {
      const res = await stats().set(asRole(role));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
    },
  );

  it('answers 401 without an internal token', async () => {
    const res = await stats();
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('answers 401 to a token signed with another secret', async () => {
    const forged = signInternalToken({ sub: randomUUID(), role: 'ADMINISTRATOR' }, 'wrong-secret');
    expect((await stats().set('x-internal-token', forged)).status).toBe(401);
  });

  it('decides the role from the token, not from a spoofed x-user-role header', async () => {
    const res = await stats().set(asRole('PATIENT')).set('x-user-role', 'ADMINISTRATOR');
    expect(res.status).toBe(403);
  });
});

describe('GET /internal/admin/stats — body', () => {
  it('answers only counts: no identifier, no glucose value', async () => {
    const patientId = randomUUID();
    await prisma.patient.create({ data: { userId: patientId } });
    await prisma.glucoseReading.create({
      data: { patientId, recordedAt: new Date(), valueMgDl: 187 },
    });

    const res = await stats().set(asRole('ADMINISTRATOR'));

    expect(res.status).toBe(200);
    expect(res.body.activePatients).toEqual({ last24h: 1, last7d: 1, registered: 1 });
    expect(res.body.readingsByDay.at(-1)).toEqual({ day: new Date().toISOString().slice(0, 10), count: 1 });
    expect(Object.keys(res.body).sort()).toEqual(['activePatients', 'alertsByType', 'grants', 'readingsByDay']);
    expect(res.text).not.toContain(patientId);
    expect(res.text).not.toContain('187');
    expect(res.text).not.toMatch(/patientId|userId/);
  });

  it('answers 30 days of readings by default', async () => {
    const res = await stats().set(asRole('ADMINISTRATOR'));
    expect(res.body.readingsByDay).toHaveLength(30);
  });

  it.each([7, 30, 90])('applies days=%i to the period', async (days) => {
    const res = await stats(`?days=${days}`).set(asRole('ADMINISTRATOR'));
    expect(res.status).toBe(200);
    expect(res.body.readingsByDay).toHaveLength(days);
  });

  it.each(['14', '0', '91', 'abc'])('rejects days=%s with 400 INVALID_DASHBOARD_RANGE', async (days) => {
    const res = await stats(`?days=${days}`).set(asRole('ADMINISTRATOR'));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'days must be one of 7, 30, 90', code: 'INVALID_DASHBOARD_RANGE' });
  });
});

describe('the other internal routes keep their own gate', () => {
  it('still answers 401 on /internal/patients/me without a token', async () => {
    expect((await request(app).get('/internal/patients/me')).status).toBe(401);
  });
});

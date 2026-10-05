import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken, type UserRoleName } from '@glucore/shared';

import { buildTestApp } from '../helpers/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * `/preferences/dashboard` end to end: LAY-07 (save), LAY-08 (load back),
 * LAY-09 (reset), LAY-11 (invalid body) and LAY-12 (only the token's user).
 */

let app: Express;

interface Caller {
  id: string;
  auth: { Authorization: string };
}

async function createCaller(email: string, role: UserRoleName): Promise<Caller> {
  const { id } = await prisma.user.create({
    data: { email, fullName: 'Pessoa Teste', role },
    select: { id: true },
  });
  const token = signAccessToken({ sub: id, role }, TEST_JWT_SECRET);
  return { id, auth: { Authorization: `Bearer ${token}` } };
}

let patientA: Caller;
let patientB: Caller;
let professional: Caller;

const LAYOUT = [
  { id: 'kpi-tir', size: 'S' },
  { id: 'chart-agp', size: 'L' },
  { id: 'kpi-gmi', size: 'M' },
];

beforeAll(() => {
  app = buildTestApp().app;
});

beforeEach(async () => {
  await truncateAll();
  patientA = await createCaller('a@example.com', 'PATIENT');
  patientB = await createCaller('b@example.com', 'PATIENT');
  professional = await createCaller('pro@example.com', 'HEALTH_PROFESSIONAL');
});

afterAll(async () => {
  await disconnect();
});

const get = (caller: Caller) => request(app).get('/preferences/dashboard').set(caller.auth);
const put = (caller: Caller, body: unknown) =>
  request(app)
    .put('/preferences/dashboard')
    .set(caller.auth)
    .send(body as object);
const del = (caller: Caller) => request(app).delete('/preferences/dashboard').set(caller.auth);

describe('authentication', () => {
  it.each(['get', 'put', 'delete'] as const)(
    '%s without a token answers 401 TOKEN_INVALID',
    async (method) => {
      const res = await request(app)[method]('/preferences/dashboard').send({ widgets: LAYOUT });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    },
  );

  it('answers 401 TOKEN_INVALID for a token signed with another secret', async () => {
    const forged = signAccessToken({ sub: patientA.id, role: 'PATIENT' }, 'not-the-secret');
    const res = await request(app)
      .get('/preferences/dashboard')
      .set({ Authorization: `Bearer ${forged}` });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  });
});

describe('GET /preferences/dashboard', () => {
  it('answers { widgets: null } when nothing was saved', async () => {
    const res = await get(patientA);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ widgets: null });
  });
});

describe('PUT /preferences/dashboard', () => {
  it('saves the layout, answers 200 with it, and GET returns the same layout', async () => {
    const saved = await put(patientA, { widgets: LAYOUT });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ widgets: LAYOUT });

    const loaded = await get(patientA);
    expect(loaded.status).toBe(200);
    expect(loaded.body).toEqual({ widgets: LAYOUT });
  });

  it('replaces the previous layout (last write wins)', async () => {
    await put(patientA, { widgets: LAYOUT });
    await put(patientA, { widgets: [{ id: 'kpi-cv', size: 'M' }] });

    expect((await get(patientA)).body).toEqual({ widgets: [{ id: 'kpi-cv', size: 'M' }] });
  });

  it.each([
    ['an id outside the catalog', { widgets: [{ id: 'chart-unknown', size: 'M' }] }],
    ['a repeated id', { widgets: [{ id: 'kpi-tir', size: 'S' }, { id: 'kpi-tir', size: 'M' }] }],
    ['an invalid size', { widgets: [{ id: 'kpi-tir', size: 'XL' }] }],
    ['widgets that is not an array', { widgets: 'kpi-tir' }],
    ['a body that is not an object', [{ id: 'kpi-tir', size: 'M' }]],
  ])('answers 400 INVALID_LAYOUT for %s and keeps the stored layout', async (_case, body) => {
    await put(patientA, { widgets: LAYOUT });

    const res = await put(patientA, body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_LAYOUT');

    expect((await get(patientA)).body).toEqual({ widgets: LAYOUT });
  });

  it('writes nothing when the first PUT is invalid', async () => {
    const res = await put(patientA, { widgets: [{ id: 'kpi-tir', size: 'XL' }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_LAYOUT');
    expect(await prisma.dashboardLayout.count()).toBe(0);
  });

  it('lets a professional save professional widgets', async () => {
    const proLayout = [{ id: 'pro-patients-table', size: 'L' }];
    const res = await put(professional, { widgets: proLayout });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ widgets: proLayout });
  });

  it('rejects a patient widget from a professional with 400 INVALID_LAYOUT', async () => {
    const res = await put(professional, { widgets: [{ id: 'kpi-tir', size: 'M' }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_LAYOUT');
    expect((await get(professional)).body).toEqual({ widgets: null });
  });
});

describe('DELETE /preferences/dashboard', () => {
  it('answers 204 and GET goes back to { widgets: null }', async () => {
    await put(patientA, { widgets: LAYOUT });

    const res = await del(patientA);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    expect((await get(patientA)).body).toEqual({ widgets: null });
  });

  it('answers 204 when there is nothing to delete', async () => {
    expect((await del(patientA)).status).toBe(204);
  });
});

describe('isolation between users', () => {
  it("user B does not read user A's layout", async () => {
    await put(patientA, { widgets: LAYOUT });
    expect((await get(patientB)).body).toEqual({ widgets: null });
  });

  it("user B cannot overwrite user A's layout by naming A in the body", async () => {
    await put(patientA, { widgets: LAYOUT });

    const res = await put(patientB, {
      userId: patientA.id,
      widgets: [{ id: 'kpi-cv', size: 'S' }],
    });
    expect(res.status).toBe(200);

    expect((await get(patientA)).body).toEqual({ widgets: LAYOUT });
    expect((await get(patientB)).body).toEqual({ widgets: [{ id: 'kpi-cv', size: 'S' }] });
  });

  it("user B cannot read A's layout through a user id in the path", async () => {
    await put(patientA, { widgets: LAYOUT });
    const res = await request(app)
      .get(`/preferences/dashboard/${patientA.id}`)
      .set(patientB.auth);
    expect(res.status).toBe(404);
    expect(res.body).not.toEqual({ widgets: LAYOUT });
  });

  it("user B's DELETE leaves A's layout in place", async () => {
    await put(patientA, { widgets: LAYOUT });
    await del(patientB);
    expect((await get(patientA)).body).toEqual({ widgets: LAYOUT });
  });
});

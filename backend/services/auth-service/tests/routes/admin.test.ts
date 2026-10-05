import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signInternalToken, type UserRoleName } from '@glucore/shared';

import { buildTestApp } from '../helpers/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * `/internal/admin/*` end to end (ADM-05): an administrator identity gets the
 * data, any other role is `403 FORBIDDEN_ROLE`, no internal token is `401`.
 * Identity is the signed internal token alone.
 */

let app: Express;
let adminId: string;

const asRole = (role: UserRoleName, sub = adminId) => ({
  'x-internal-token': signInternalToken({ sub, role }, TEST_INTERNAL_JWT_SECRET),
});

beforeAll(() => {
  app = buildTestApp().app;
});

beforeEach(async () => {
  await truncateAll();
  adminId = (
    await prisma.user.create({
      data: { email: 'admin@example.com', fullName: 'Admin', role: 'ADMINISTRATOR' },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  await disconnect();
});

describe.each(['/internal/admin/stats', '/internal/admin/users'])('GET %s — access', (path) => {
  it('answers 200 to an administrator identity', async () => {
    const res = await request(app).get(path).set(asRole('ADMINISTRATOR'));
    expect(res.status).toBe(200);
  });

  it.each(['PATIENT', 'HEALTH_PROFESSIONAL'] as const)(
    'answers 403 FORBIDDEN_ROLE to a %s identity',
    async (role) => {
      const res = await request(app).get(path).set(asRole(role));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
    },
  );

  it('answers 401 without an internal token', async () => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('answers 401 to a token signed with another secret', async () => {
    const forged = signInternalToken({ sub: adminId, role: 'ADMINISTRATOR' }, 'wrong-secret');
    const res = await request(app).get(path).set('x-internal-token', forged);
    expect(res.status).toBe(401);
  });

  it('decides the role from the token, not from a spoofed x-user-role header', async () => {
    const res = await request(app).get(path).set(asRole('PATIENT')).set('x-user-role', 'ADMINISTRATOR');
    expect(res.status).toBe(403);
  });
});

describe('GET /internal/admin/stats', () => {
  it('answers the account statistics, 30 days by default', async () => {
    await prisma.user.create({ data: { email: 'pro@example.com', fullName: 'Pro', role: 'HEALTH_PROFESSIONAL' } });

    const res = await request(app).get('/internal/admin/stats').set(asRole('ADMINISTRATOR'));

    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual({
      total: 2,
      byRole: [
        { role: 'PATIENT', count: 0 },
        { role: 'HEALTH_PROFESSIONAL', count: 1 },
        { role: 'ADMINISTRATOR', count: 1 },
      ],
      byStatus: [
        { status: 'ACTIVE', count: 2 },
        { status: 'INACTIVE', count: 0 },
        { status: 'BLOCKED', count: 0 },
      ],
    });
    expect(res.body.registrationsInPeriod).toBe(2);
    expect(res.body.registrationsByDay).toHaveLength(30);
    const today = new Date().toISOString().slice(0, 10);
    expect(res.body.registrationsByDay.at(-1)).toEqual({ day: today, count: 2 });
  });

  it.each([7, 30, 90])('passes days=%i to the period', async (days) => {
    const res = await request(app).get(`/internal/admin/stats?days=${days}`).set(asRole('ADMINISTRATOR'));
    expect(res.status).toBe(200);
    expect(res.body.registrationsByDay).toHaveLength(days);
  });

  it.each(['14', '0', '91', 'abc', '7.5'])('rejects days=%s with 400 INVALID_DASHBOARD_RANGE', async (days) => {
    const res = await request(app).get(`/internal/admin/stats?days=${days}`).set(asRole('ADMINISTRATOR'));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'days must be one of 7, 30, 90', code: 'INVALID_DASHBOARD_RANGE' });
  });
});

describe('GET /internal/admin/users', () => {
  it('answers a page of accounts and applies the query filters', async () => {
    await prisma.user.create({ data: { email: 'bia@example.com', fullName: 'Bia', status: 'BLOCKED' } });

    const res = await request(app)
      .get('/internal/admin/users?status=BLOCKED&q=BIA&limit=10')
      .set(asRole('ADMINISTRATOR'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 1 });
    expect(res.body.items).toEqual([
      expect.objectContaining({ email: 'bia@example.com', role: 'PATIENT', status: 'BLOCKED' }),
    ]);
  });

  it('audits the read against the admin of the token, ignoring any id in the query', async () => {
    const other = await prisma.user.create({ data: { email: 'other@example.com', fullName: 'Other' } });

    await request(app)
      .get(`/internal/admin/users?userId=${other.id}`)
      .set(asRole('ADMINISTRATOR'))
      .set('user-agent', 'admin-browser');

    const rows = await prisma.auditLog.findMany({ where: { action: 'ADMIN_LIST_USERS' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: adminId, userAgent: 'admin-browser' });
  });

  it('does not audit a request that was refused', async () => {
    await request(app).get('/internal/admin/users').set(asRole('PATIENT'));
    expect(await prisma.auditLog.count({ where: { action: 'ADMIN_LIST_USERS' } })).toBe(0);
  });

  it('answers 400 INVALID_FILTER for an unknown role', async () => {
    const res = await request(app).get('/internal/admin/users?role=ROOT').set(asRole('ADMINISTRATOR'));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILTER');
  });

  it('answers 400 INVALID_PAGINATION for a limit above 100', async () => {
    const res = await request(app).get('/internal/admin/users?limit=101').set(asRole('ADMINISTRATOR'));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAGINATION');
  });
});

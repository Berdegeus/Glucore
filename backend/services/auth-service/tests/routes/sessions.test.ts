import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken, verifyAccessToken } from '@glucore/shared';

import { buildTestApp } from '../helpers/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_JWT_SECRET } from '../helpers/testEnv';

/** Login and status, ported from the monolith's /auth suite. */

let app: Express;
let user: { token: string; userId: string; email: string };

const STRONG = 'Senha123!';
const uniqueEmail = () => `login.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;

beforeAll(() => {
  app = buildTestApp().app;
});

beforeEach(async () => {
  await truncateAll();
  const email = uniqueEmail();
  const res = await request(app)
    .post('/auth/register')
    .send({ email, password: STRONG, fullName: 'Paciente Teste' });
  const claims = verifyAccessToken(res.body.token as string, TEST_JWT_SECRET);
  user = { token: res.body.token, userId: claims!.sub, email };
});

afterAll(async () => {
  await disconnect();
});

const login = (body: Record<string, unknown>) => request(app).post('/auth/login').send(body);

describe('POST /auth/login', () => {
  it('returns a token for correct credentials', async () => {
    const res = await login({ email: user.email, password: STRONG });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('puts the role in the token, not just the subject', async () => {
    const res = await login({ email: user.email, password: STRONG });
    expect(verifyAccessToken(res.body.token as string, TEST_JWT_SECRET)).toEqual({
      sub: user.userId,
      role: 'PATIENT',
    });
  });

  it('accepts a differently-cased email', async () => {
    expect((await login({ email: user.email.toUpperCase(), password: STRONG })).status).toBe(200);
  });

  it('answers 401 for a wrong password', async () => {
    const res = await login({ email: user.email, password: 'Errada123!' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('answers 401 — not 404 — for an unknown address', async () => {
    // Same status and same body as a wrong password. Telling them apart would
    // make login an oracle for which addresses have accounts.
    const res = await login({ email: 'nobody@example.com', password: STRONG });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it.each([
    ['no email', { password: STRONG }],
    ['no password', { email: 'a@b.com' }],
  ])('answers 400 with %s', async (_label, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('stamps lastLoginAt and opens another session', async () => {
    const before = await prisma.authSession.count({ where: { userId: user.userId } });
    await login({ email: user.email, password: STRONG });

    const credential = await prisma.authCredential.findUnique({ where: { userId: user.userId } });
    expect(credential?.lastLoginAt).not.toBeNull();
    expect(await prisma.authSession.count({ where: { userId: user.userId } })).toBe(before + 1);
  });

  it('gives the session the same lifetime as the token it was issued with', async () => {
    await login({ email: user.email, password: STRONG });
    const session = await prisma.authSession.findFirst({
      where: { userId: user.userId },
      orderBy: { issuedAt: 'desc' },
    });
    const days = (session!.expiresAt.getTime() - session!.issuedAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('records a LOGIN audit entry', async () => {
    await login({ email: user.email, password: STRONG });
    expect(
      await prisma.auditLog.findFirst({ where: { userId: user.userId, action: 'LOGIN' } }),
    ).not.toBeNull();
  });

  it('never writes the password into the audit trail', async () => {
    await login({ email: user.email, password: STRONG });
    const entries = await prisma.auditLog.findMany({ where: { userId: user.userId } });
    expect(JSON.stringify(entries)).not.toContain(STRONG);
  });
});

describe('GET /auth/status', () => {
  it('reports the authenticated user', async () => {
    const res = await request(app).get('/auth/status').set({ Authorization: `Bearer ${user.token}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ loggedIn: true, userId: user.userId });
  });

  it('answers 401 without a token', async () => {
    expect((await request(app).get('/auth/status')).status).toBe(401);
  });

  it('answers 401 for a token signed with another secret', async () => {
    const forged = signAccessToken({ sub: user.userId, role: 'PATIENT' }, 'not-the-secret');
    const res = await request(app).get('/auth/status').set({ Authorization: `Bearer ${forged}` });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  });
});

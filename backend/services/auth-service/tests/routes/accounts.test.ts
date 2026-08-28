import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { verifyAccessToken } from '@glucore/shared';

import { buildTestApp } from '../helpers/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * Registration and the account slice of the profile, ported from the monolith's
 * /auth suite.
 *
 * Seven cases from that file do not appear here, and none of them was dropped
 * because it stopped mattering — they assert behaviour that spans both services
 * now and comes back when the gateway composes them (phase 4.3):
 *
 *   - creates User, Patient and AlertThresholdConfig in one go
 *   - seeds the threshold config from the target range
 *   - returns the account and patient blocks together
 *   - renders birthDate as a bare date, not a timestamp
 *   - returns weightKg as a number, not a Decimal string
 *   - updates patient fields
 *   - re-syncs the alert thresholds when the target range moves
 *
 * The first two are asserted here in reduced form (account only). The rest are
 * about the patient half, which this service cannot see.
 */

let app: Express;
let user: { token: string; userId: string; email: string };

const STRONG = 'Senha123!';
const uniqueEmail = () => `new.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;

const register = (body: Record<string, unknown>) => request(app).post('/auth/register').send(body);

beforeAll(() => {
  app = buildTestApp().app;
});

beforeEach(async () => {
  await truncateAll();
  const email = uniqueEmail();
  const res = await register({ email, password: STRONG, fullName: 'Paciente Teste' });
  if (res.status !== 201) throw new Error(`fixture expected 201, got ${res.status}: ${res.text}`);
  const claims = verifyAccessToken(res.body.token as string, TEST_JWT_SECRET);
  user = { token: res.body.token, userId: claims!.sub, email };
});

afterAll(async () => {
  await disconnect();
});

const auth = () => ({ Authorization: `Bearer ${user.token}` });

describe('POST /auth/register', () => {
  it('creates the account and answers 201 with a token', async () => {
    const res = await register({ email: uniqueEmail(), password: STRONG, fullName: 'Novo Paciente' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
  });

  it('creates User and AuthCredential together', async () => {
    // The monolith created Patient and AlertThresholdConfig in the same nested
    // write. Those rows are in another database now; the gateway's saga is what
    // puts them back.
    const email = uniqueEmail();
    await register({ email, password: STRONG, fullName: 'Novo Paciente' });

    const created = await prisma.user.findUnique({
      where: { email },
      include: { authCredential: true },
    });
    expect(created).not.toBeNull();
    expect(created?.authCredential).not.toBeNull();
    expect(created?.role).toBe('PATIENT');
  });

  it('mints a token carrying the subject and the role', async () => {
    const res = await register({ email: uniqueEmail(), password: STRONG, fullName: 'Novo Paciente' });
    const claims = verifyAccessToken(res.body.token as string, TEST_JWT_SECRET);
    expect(claims?.role).toBe('PATIENT');
    expect(claims?.sub).toEqual(expect.any(String));
  });

  it('opens an AuthSession', async () => {
    const email = uniqueEmail();
    await register({ email, password: STRONG, fullName: 'Novo Paciente' });
    const created = await prisma.user.findUnique({ where: { email }, include: { authSessions: true } });
    expect(created?.authSessions).toHaveLength(1);
  });

  it('lower-cases and trims the email', async () => {
    const email = uniqueEmail();
    const res = await register({
      email: `  ${email.toUpperCase()}  `,
      password: STRONG,
      fullName: 'Novo Paciente',
    });
    expect(res.status).toBe(201);
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it('answers 409 EMAIL_TAKEN for a duplicate address', async () => {
    const res = await register({ email: user.email, password: STRONG, fullName: 'Outro' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
  });

  it('treats a differently-cased duplicate as taken', async () => {
    const res = await register({
      email: user.email.toUpperCase(),
      password: STRONG,
      fullName: 'Outro',
    });
    expect(res.status).toBe(409);
  });

  it.each([
    ['a missing email', { password: STRONG, fullName: 'Novo Paciente' }],
    ['a malformed email', { email: 'not-an-email', password: STRONG, fullName: 'Novo Paciente' }],
    ['a missing password', { email: 'a@b.com', fullName: 'Novo Paciente' }],
    ['a missing name', { email: 'a@b.com', password: STRONG }],
    ['a name below three characters', { email: 'a@b.com', password: STRONG, fullName: 'ab' }],
  ])('answers 400 for %s', async (_label, body) => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('answers 400 WEAK_PASSWORD for a password that fails the policy', async () => {
    const res = await register({ email: uniqueEmail(), password: 'senha', fullName: 'Novo Paciente' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
  });

  it('rejects a weak password before writing anything', async () => {
    const email = uniqueEmail();
    await register({ email, password: 'senha', fullName: 'Novo Paciente' });
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('records a REGISTER audit entry carrying the email but no password', async () => {
    const email = uniqueEmail();
    await register({ email, password: STRONG, fullName: 'Novo Paciente' });
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'REGISTER', metadata: { path: ['email'], equals: email } },
    });
    expect(entry).not.toBeNull();
    expect(JSON.stringify(entry?.metadata)).not.toContain(STRONG);
  });
});

describe('GET /auth/profile', () => {
  it('returns the account block', async () => {
    // The patient block used to come back in the same payload. It is in another
    // database now; the gateway composes the two (phase 6.2).
    const res = await request(app).get('/auth/profile').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.userId,
      email: user.email,
      fullName: 'Paciente Teste',
      phone: null,
      status: 'ACTIVE',
      role: 'PATIENT',
      createdAt: expect.any(String),
    });
  });

  it('never exposes the password hash', async () => {
    const res = await request(app).get('/auth/profile').set(auth());
    expect(JSON.stringify(res.body)).not.toContain('$2');
  });

  it('answers 401 without a token', async () => {
    expect((await request(app).get('/auth/profile')).status).toBe(401);
  });
});

describe('PUT /auth/profile', () => {
  const put = (body: Record<string, unknown>) =>
    request(app).put('/auth/profile').set(auth()).send(body);

  it('updates plain account fields without demanding the current password', async () => {
    const res = await put({ fullName: 'Nome Novo', phone: '11999998888' });
    expect(res.status).toBe(200);
    const stored = await prisma.user.findUnique({ where: { id: user.userId } });
    expect(stored?.fullName).toBe('Nome Novo');
    expect(stored?.phone).toBe('11999998888');
  });

  it('clears the phone when sent empty', async () => {
    await put({ phone: '11999998888' });
    await put({ phone: '' });
    expect((await prisma.user.findUnique({ where: { id: user.userId } }))?.phone).toBeNull();
  });

  it('rejects a name below three characters', async () => {
    const res = await put({ fullName: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('demands the current password to change the email', async () => {
    const res = await put({ newEmail: uniqueEmail() });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Current password required' });
  });

  it('answers 401 INVALID_CURRENT_PASSWORD when the current password is wrong', async () => {
    // Distinct from TOKEN_INVALID on purpose: the session is still good, so the
    // app must show the error rather than log the user out. It branches on this
    // code.
    const res = await put({ newEmail: uniqueEmail(), currentPassword: 'Errada123!' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid password', code: 'INVALID_CURRENT_PASSWORD' });
  });

  it('changes the email when the current password checks out', async () => {
    const newEmail = uniqueEmail();
    const res = await put({ newEmail, currentPassword: STRONG });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: user.userId } }))?.email).toBe(newEmail);
  });

  it('answers 409 when the new email belongs to somebody else', async () => {
    const taken = uniqueEmail();
    await register({ email: taken, password: STRONG, fullName: 'Outra Pessoa' });
    const res = await put({ newEmail: taken, currentPassword: STRONG });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
  });

  it('changes the password and lets the new one log in', async () => {
    const newPassword = 'OutraSenha1!';
    expect((await put({ newPassword, currentPassword: STRONG })).status).toBe(200);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: newPassword });
    expect(login.status).toBe(200);
  });

  it('rejects a new password that fails the policy', async () => {
    const res = await put({ newPassword: 'fraca', currentPassword: STRONG });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
  });

  it('records which areas changed, never the values', async () => {
    await put({ fullName: 'Nome Novo', newPassword: 'OutraSenha1!', currentPassword: STRONG });
    const entry = await prisma.auditLog.findFirst({
      where: { userId: user.userId, action: 'UPDATE_PROFILE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry?.metadata).toEqual({ changed: ['fullName', 'password'] });
    expect(JSON.stringify(entry?.metadata)).not.toContain('OutraSenha1!');
  });

  it('answers 401 without a token', async () => {
    expect((await request(app).put('/auth/profile').send({ fullName: 'X' })).status).toBe(401);
  });
});

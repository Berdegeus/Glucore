import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, registerUser, truncateAll, type RegisteredUser } from '../helpers/db';

/**
 * Characterization tests for /auth — the 600-line route the refactor splits
 * hardest. These assertions are the contract that survives the split: register
 * and the profile read/write end up straddling two services, so anything not
 * pinned here is something the saga and the gateway composition could silently
 * change.
 */

let app: Express;
let user: RegisteredUser;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  user = await registerUser(app);
});

afterAll(async () => {
  await disconnect();
});

const auth = () => ({ Authorization: `Bearer ${user.token}` });

const STRONG = 'Senha123!';
const uniqueEmail = () => `new.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;

const register = (body: Record<string, unknown>) => request(app).post('/auth/register').send(body);

describe('POST /auth/register', () => {
  it('creates the account and answers 201 with a token', async () => {
    const res = await register({ email: uniqueEmail(), password: STRONG, fullName: 'Ana Souza' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
  });

  it('creates User, Patient and AlertThresholdConfig in one go', async () => {
    const email = uniqueEmail();
    await register({ email, password: STRONG, fullName: 'Ana Souza' });

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { patient: { include: { alertThresholdConfig: true } }, authCredential: true },
    });
    expect(created.role).toBe('PATIENT');
    expect(created.patient).not.toBeNull();
    expect(created.patient?.alertThresholdConfig).not.toBeNull();
    expect(created.authCredential).not.toBeNull();
  });

  it('seeds the threshold config from the target range', async () => {
    const email = uniqueEmail();
    await register({
      email,
      password: STRONG,
      fullName: 'Ana Souza',
      targetRangeMin: 70,
      targetRangeMax: 200,
    });

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { patient: { include: { alertThresholdConfig: true } } },
    });
    expect(created.patient?.alertThresholdConfig).toMatchObject({
      lowGlucoseMgDl: 70,
      highGlucoseMgDl: 200,
    });
  });

  it('opens an AuthSession', async () => {
    const email = uniqueEmail();
    await register({ email, password: STRONG, fullName: 'Ana Souza' });
    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { authSessions: true },
    });
    expect(created.authSessions).toHaveLength(1);
    expect(created.authSessions[0].isRevoked).toBe(false);
  });

  it('lower-cases and trims the email', async () => {
    const email = uniqueEmail();
    await register({ email: `  ${email.toUpperCase()}  `, password: STRONG, fullName: 'Ana Souza' });
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it('answers 409 EMAIL_TAKEN for a duplicate address', async () => {
    const res = await register({ email: user.email, password: STRONG, fullName: 'Outra Pessoa' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
  });

  it('treats a differently-cased duplicate as taken', async () => {
    const res = await register({
      email: user.email.toUpperCase(),
      password: STRONG,
      fullName: 'Outra Pessoa',
    });
    expect(res.status).toBe(409);
  });

  it.each([
    ['the email is missing', { password: STRONG, fullName: 'Ana Souza' }],
    ['the email is malformed', { email: 'not-an-email', password: STRONG, fullName: 'Ana Souza' }],
    ['the password is missing', { email: 'a@b.com', fullName: 'Ana Souza' }],
    ['fullName is shorter than 3', { email: 'a@b.com', password: STRONG, fullName: 'Al' }],
    ['fullName is missing', { email: 'a@b.com', password: STRONG }],
    [
      'the target range is inverted',
      {
        email: 'a@b.com',
        password: STRONG,
        fullName: 'Ana Souza',
        targetRangeMin: 200,
        targetRangeMax: 100,
      },
    ],
    [
      'birthDate is unparseable',
      { email: 'a@b.com', password: STRONG, fullName: 'Ana Souza', birthDate: '32/13/2020' },
    ],
    [
      'weightKg is not a number',
      { email: 'a@b.com', password: STRONG, fullName: 'Ana Souza', weightKg: 'heavy' },
    ],
    [
      'weightKg is zero or less',
      { email: 'a@b.com', password: STRONG, fullName: 'Ana Souza', weightKg: 0 },
    ],
  ])('answers 400 when %s', async (_label, body) => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('answers 400 WEAK_PASSWORD for a password that fails the policy', async () => {
    const res = await register({ email: uniqueEmail(), password: 'senha123', fullName: 'Ana Souza' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
  });

  it.each([
    ['2000-05-17', Date.UTC(2000, 4, 17)],
    ['17/05/2000', Date.UTC(2000, 4, 17)],
  ])('accepts birthDate in the %s format', async (birthDate, expected) => {
    const email = uniqueEmail();
    await register({ email, password: STRONG, fullName: 'Ana Souza', birthDate });

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { patient: true },
    });
    expect(created.patient?.birthDate?.getTime()).toBe(expected);
  });

  it('records a REGISTER audit entry carrying the email but no password', async () => {
    const email = uniqueEmail();
    await register({ email, password: STRONG, fullName: 'Ana Souza' });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'User', action: 'REGISTER', metadata: { path: ['email'], equals: email } },
    });
    expect(JSON.stringify(entry.metadata)).not.toContain(STRONG);
  });
});

describe('POST /auth/login', () => {
  it('returns a token for correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('accepts a differently-cased email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email.toUpperCase(), password: user.password });
    expect(res.status).toBe(200);
  });

  it('answers 401 for a wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'Errada123!' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('answers 401 — not 404 — for an unknown address', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: uniqueEmail(), password: STRONG });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it.each([
    ['no email', { password: STRONG }],
    ['no password', { email: 'a@b.com' }],
  ])('answers 400 with %s', async (_label, body) => {
    const res = await request(app).post('/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('stamps lastLoginAt and opens another session', async () => {
    await request(app).post('/auth/login').send({ email: user.email, password: user.password });

    const credential = await prisma.authCredential.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    expect(credential.lastLoginAt).not.toBeNull();
    expect(await prisma.authSession.count({ where: { userId: user.userId } })).toBe(2);
  });

  it('records a LOGIN audit entry', async () => {
    await request(app).post('/auth/login').send({ email: user.email, password: user.password });
    expect(
      await prisma.auditLog.count({ where: { entity: 'User', action: 'LOGIN' } }),
    ).toBe(1);
  });
});

describe('GET /auth/status', () => {
  it('reports the authenticated user', async () => {
    const res = await request(app).get('/auth/status').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ loggedIn: true, userId: user.userId });
  });

  it('answers 401 without a token', async () => {
    expect((await request(app).get('/auth/status')).status).toBe(401);
  });
});

describe('GET /auth/profile', () => {
  it('returns the account and patient blocks together', async () => {
    const res = await request(app).get('/auth/profile').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.userId,
      email: user.email,
      fullName: 'Paciente Teste',
      status: 'ACTIVE',
      role: 'PATIENT',
      patient: {
        birthDate: null,
        diabetesType: null,
        weightKg: null,
        targetRangeMin: 80,
        targetRangeMax: 180,
      },
    });
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('renders birthDate as a bare date, not a timestamp', async () => {
    await prisma.patient.update({
      where: { userId: user.userId },
      data: { birthDate: new Date(Date.UTC(2000, 4, 17)) },
    });
    const res = await request(app).get('/auth/profile').set(auth());
    expect(res.body.patient.birthDate).toBe('2000-05-17');
  });

  it('returns weightKg as a number, not a Decimal string', async () => {
    await prisma.patient.update({
      where: { userId: user.userId },
      data: { weightKg: 72.5 },
    });
    const res = await request(app).get('/auth/profile').set(auth());
    expect(res.body.patient.weightKg).toBe(72.5);
  });

  it('never exposes the password hash', async () => {
    const res = await request(app).get('/auth/profile').set(auth());
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('answers 401 without a token', async () => {
    expect((await request(app).get('/auth/profile')).status).toBe(401);
  });
});

describe('PUT /auth/profile', () => {
  const put = (body: Record<string, unknown>) =>
    request(app).put('/auth/profile').set(auth()).send(body);

  it('updates plain account fields without demanding the current password', async () => {
    const res = await put({ fullName: 'Ana Maria', phone: '11999998888' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Profile updated.' });

    const after = await request(app).get('/auth/profile').set(auth());
    expect(after.body.fullName).toBe('Ana Maria');
    expect(after.body.phone).toBe('11999998888');
  });

  it('updates patient fields', async () => {
    await put({ birthDate: '2000-05-17', diabetesType: 'TIPO_1', weightKg: 68.2 });

    const after = await request(app).get('/auth/profile').set(auth());
    expect(after.body.patient).toMatchObject({
      birthDate: '2000-05-17',
      diabetesType: 'TIPO_1',
      weightKg: 68.2,
    });
  });

  it('re-syncs the alert thresholds when the target range moves', async () => {
    await put({ targetRangeMin: 70, targetRangeMax: 200 });

    const settings = await request(app).get('/settings/alerts').set(auth());
    expect(settings.body).toEqual({ lowThreshold: 70, highThreshold: 200 });
  });

  it('rejects an inverted target range', async () => {
    const res = await put({ targetRangeMin: 200, targetRangeMax: 100 });
    expect(res.status).toBe(400);
  });

  it('demands the current password to change the email', async () => {
    const res = await put({ newEmail: uniqueEmail() });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Current password required' });
  });

  it('answers 401 when the current password is wrong', async () => {
    const res = await put({ newEmail: uniqueEmail(), currentPassword: 'Errada123!' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid password', code: 'INVALID_CURRENT_PASSWORD' });
  });

  it('changes the email when the current password checks out', async () => {
    const newEmail = uniqueEmail();
    const res = await put({ newEmail, currentPassword: user.password });
    expect(res.status).toBe(200);

    const after = await request(app).get('/auth/profile').set(auth());
    expect(after.body.email).toBe(newEmail);
  });

  it('answers 409 when the new email belongs to somebody else', async () => {
    const other = await registerUser(app);
    const res = await put({ newEmail: other.email, currentPassword: user.password });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
  });

  it('changes the password and lets the new one log in', async () => {
    const newPassword = 'NovaSenha1!';
    expect((await put({ newPassword, currentPassword: user.password })).status).toBe(200);

    const relogin = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: newPassword });
    expect(relogin.status).toBe(200);
  });

  it('rejects a new password that fails the policy', async () => {
    const res = await put({ newPassword: 'fraca', currentPassword: user.password });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
  });

  it('records which areas changed, never the values', async () => {
    await put({ fullName: 'Ana Maria', newPassword: 'NovaSenha1!', currentPassword: user.password });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'User', action: 'UPDATE_PROFILE' },
    });
    const metadata = JSON.stringify(entry.metadata);
    expect(metadata).toContain('fullName');
    expect(metadata).not.toContain('NovaSenha1!');
  });
});

describe('password reset flow', () => {
  it('answers 200 for an unknown address without revealing anything', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: uniqueEmail() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'If the email is registered, instructions were sent.' });
  });

  it('answers identically for a registered address', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: user.email });
    expect(res.body).toEqual({ message: 'If the email is registered, instructions were sent.' });
  });

  it('issues a token only for a registered address', async () => {
    await request(app).post('/auth/forgot-password').send({ email: uniqueEmail() });
    expect(await prisma.passwordResetToken.count()).toBe(0);

    await request(app).post('/auth/forgot-password').send({ email: user.email });
    expect(await prisma.passwordResetToken.count({ where: { userId: user.userId } })).toBe(1);
  });

  it('replaces an outstanding unused token rather than stacking them', async () => {
    await request(app).post('/auth/forgot-password').send({ email: user.email });
    await request(app).post('/auth/forgot-password').send({ email: user.email });
    expect(await prisma.passwordResetToken.count({ where: { userId: user.userId } })).toBe(1);
  });

  it('answers 400 for a malformed address', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid email' });
  });

  it('resets the password with a valid token and marks it used', async () => {
    await request(app).post('/auth/forgot-password').send({ email: user.email });
    const { token } = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.userId },
    });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'NovaSenha1!' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password reset successful.' });

    const used = await prisma.passwordResetToken.findUniqueOrThrow({ where: { token } });
    expect(used.usedAt).not.toBeNull();

    const relogin = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'NovaSenha1!' });
    expect(relogin.status).toBe(200);
  });

  it('refuses to reuse a spent token', async () => {
    await request(app).post('/auth/forgot-password').send({ email: user.email });
    const { token } = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.userId },
    });
    await request(app).post('/auth/reset-password').send({ token, password: 'NovaSenha1!' });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'OutraSenha1!' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('refuses an expired token', async () => {
    await request(app).post('/auth/forgot-password').send({ email: user.email });
    const { token } = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.userId },
    });
    await prisma.passwordResetToken.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'NovaSenha1!' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('refuses an unknown token', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'e0a1b2c3-d4e5-4f60-8718-293a4b5c6d7e', password: 'NovaSenha1!' });
    expect(res.status).toBe(400);
  });

  it('rejects a weak replacement password before looking the token up', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'anything', password: 'fraca' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
  });

  it.each([
    ['no token', { password: STRONG }],
    ['no password', { token: 'abc' }],
  ])('answers 400 with %s', async (_label, body) => {
    const res = await request(app).post('/auth/reset-password').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('never writes the reset token into the audit trail', async () => {
    await request(app).post('/auth/forgot-password').send({ email: user.email });
    const { token } = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.userId },
    });

    const entries = await prisma.auditLog.findMany({ where: { action: 'FORGOT_PASSWORD' } });
    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries)).not.toContain(token);
  });
});

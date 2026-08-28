import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type RecordingMailer } from '../helpers/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';

/**
 * The password reset flow, ported from the monolith's /auth suite.
 *
 * One thing got easier in the move: the token is read from an injected mailer
 * instead of scraped from the console. The old tests had no choice — the token
 * only surfaced through the catch-and-log fallback, so asserting on it meant
 * asserting on a log line written by an error path.
 */

let app: Express;
let mailer: RecordingMailer;
let user: { email: string };

const STRONG = 'Senha123!';
const uniqueEmail = () => `reset.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;

const NEUTRAL = { message: 'If the email is registered, instructions were sent.' };

beforeAll(() => {
  ({ app, mailer } = buildTestApp());
});

beforeEach(async () => {
  await truncateAll();
  mailer.sent.length = 0;
  const email = uniqueEmail();
  await request(app).post('/auth/register').send({ email, password: STRONG, fullName: 'Paciente' });
  user = { email };
});

afterAll(async () => {
  await disconnect();
});

const forgot = (email: unknown) => request(app).post('/auth/forgot-password').send({ email });
const reset = (body: Record<string, unknown>) =>
  request(app).post('/auth/reset-password').send(body);

describe('POST /auth/forgot-password', () => {
  it('answers 200 for an unknown address without revealing anything', async () => {
    const res = await forgot('nobody@example.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(NEUTRAL);
  });

  it('answers identically for a registered address', async () => {
    const res = await forgot(user.email);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(NEUTRAL);
  });

  it('issues a token only for a registered address', async () => {
    await forgot('nobody@example.com');
    expect(mailer.sent).toHaveLength(0);
    expect(await prisma.passwordResetToken.count()).toBe(0);

    await forgot(user.email);
    expect(mailer.lastTokenFor(user.email)).toEqual(expect.any(String));
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it('leaves no audit trail for an unknown address', async () => {
    // A row per attempt would rebuild exactly the list the neutral response
    // refuses to give away.
    await forgot('nobody@example.com');
    expect(await prisma.auditLog.count({ where: { action: 'FORGOT_PASSWORD' } })).toBe(0);
  });

  it('replaces an outstanding unused token rather than stacking them', async () => {
    await forgot(user.email);
    const first = mailer.lastTokenFor(user.email);
    await forgot(user.email);
    const second = mailer.lastTokenFor(user.email);

    expect(second).not.toBe(first);
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it('answers 400 for a malformed address', async () => {
    const res = await forgot('not-an-email');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid email' });
  });

  it('never writes the reset token into the audit trail', async () => {
    await forgot(user.email);
    const token = mailer.lastTokenFor(user.email);
    const entries = await prisma.auditLog.findMany();
    expect(JSON.stringify(entries)).not.toContain(token);
  });
});

describe('POST /auth/reset-password', () => {
  async function issueToken(): Promise<string> {
    await forgot(user.email);
    return mailer.lastTokenFor(user.email) as string;
  }

  it('resets the password with a valid token and marks it used', async () => {
    const token = await issueToken();
    const res = await reset({ token, password: 'NovaSenha1!' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password reset successful.' });
    expect((await prisma.passwordResetToken.findUnique({ where: { token } }))?.usedAt).not.toBeNull();

    const login = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'NovaSenha1!' });
    expect(login.status).toBe(200);
  });

  it('refuses to reuse a spent token', async () => {
    const token = await issueToken();
    await reset({ token, password: 'NovaSenha1!' });

    const res = await reset({ token, password: 'OutraSenha1!' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('refuses an expired token', async () => {
    const token = await issueToken();
    await prisma.passwordResetToken.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await reset({ token, password: 'NovaSenha1!' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('refuses an unknown token, saying the same thing', async () => {
    // Unknown, spent and expired all answer alike: distinguishing them would
    // say whether a token ever existed.
    const res = await reset({ token: crypto.randomUUID(), password: 'NovaSenha1!' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('rejects a weak replacement password before looking the token up', async () => {
    const token = await issueToken();
    const res = await reset({ token, password: 'fraca' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
    // The token is still good: a bad password must not burn it.
    expect((await prisma.passwordResetToken.findUnique({ where: { token } }))?.usedAt).toBeNull();
  });

  it.each([
    ['no token', { password: 'NovaSenha1!' }],
    ['no password', { token: 'whatever' }],
  ])('answers 400 with %s', async (_label, body) => {
    const res = await reset(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input' });
  });

  it('records a RESET_PASSWORD entry without the token', async () => {
    const token = await issueToken();
    await reset({ token, password: 'NovaSenha1!' });

    const entry = await prisma.auditLog.findFirst({ where: { action: 'RESET_PASSWORD' } });
    expect(entry).not.toBeNull();
    expect(JSON.stringify(entry)).not.toContain(token);
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signInternalToken } from '@glucore/shared';

import { buildTestApp } from '../helpers/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * `/internal/*` is the gateway's only path into this service's identity data.
 * These tests exist to prove the anti-spoofing scheme is real: identity comes
 * from the verified `x-internal-token`, never from `x-user-id`, even when the
 * two disagree.
 */

let app: Express;

const STRONG = 'Senha123!';
const uniqueEmail = () => `internal.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;

function internalToken(sub: string, role: 'PATIENT' | 'HEALTH_PROFESSIONAL' | 'ADMINISTRATOR' = 'PATIENT') {
  return signInternalToken({ sub, role }, TEST_INTERNAL_JWT_SECRET);
}

async function registerViaInternal(body: Record<string, unknown>) {
  return request(app)
    .post('/internal/accounts')
    .set('x-internal-token', internalToken('gateway'))
    .send(body);
}

beforeAll(() => {
  app = buildTestApp().app;
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await disconnect();
});

describe('POST /internal/accounts', () => {
  it('rejects a request with no internal token', async () => {
    const res = await request(app)
      .post('/internal/accounts')
      .send({ email: uniqueEmail(), password: STRONG, fullName: 'Novo Paciente' });
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forgedToken = signInternalToken({ sub: 'gateway', role: 'PATIENT' }, 'wrong-secret');
    const res = await request(app)
      .post('/internal/accounts')
      .set('x-internal-token', forgedToken)
      .send({ email: uniqueEmail(), password: STRONG, fullName: 'Novo Paciente' });
    expect(res.status).toBe(401);
  });

  it('creates the account and answers 201 with userId and token', async () => {
    const res = await registerViaInternal({ email: uniqueEmail(), password: STRONG, fullName: 'Novo Paciente' });
    expect(res.status).toBe(201);
    expect(typeof res.body.userId).toBe('string');
    expect(typeof res.body.token).toBe('string');
  });
});

describe('GET /internal/accounts/me', () => {
  it('rejects a request with no internal token', async () => {
    const res = await request(app).get('/internal/accounts/me');
    expect(res.status).toBe(401);
  });

  it('ignores x-user-id and resolves identity from the internal token', async () => {
    const email = uniqueEmail();
    const created = await registerViaInternal({ email, password: STRONG, fullName: 'Dona Da Conta' });
    const realUserId = created.body.userId as string;

    const otherUser = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        fullName: 'Outra Pessoa',
        role: 'PATIENT',
        authCredential: { create: { passwordHash: 'irrelevant' } },
      },
    });

    const res = await request(app)
      .get('/internal/accounts/me')
      .set('x-internal-token', internalToken(realUserId))
      // A forged header claiming to be someone else must have no effect.
      .set('x-user-id', otherUser.id);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(realUserId);
    expect(res.body.email).toBe(email);
  });
});

describe('DELETE /internal/accounts/:id', () => {
  it('rejects a request with no internal token, regardless of x-user-id', async () => {
    const created = await registerViaInternal({ email: uniqueEmail(), password: STRONG, fullName: 'A Apagar' });
    const res = await request(app)
      .delete(`/internal/accounts/${created.body.userId}`)
      .set('x-user-id', created.body.userId as string);
    expect(res.status).toBe(401);
  });

  it('deletes the account and answers 204', async () => {
    const created = await registerViaInternal({ email: uniqueEmail(), password: STRONG, fullName: 'A Apagar' });
    const userId = created.body.userId as string;

    const res = await request(app)
      .delete(`/internal/accounts/${userId}`)
      .set('x-internal-token', internalToken('gateway'));
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });

  it('is idempotent: deleting an already-gone id still answers 204', async () => {
    const created = await registerViaInternal({ email: uniqueEmail(), password: STRONG, fullName: 'A Apagar' });
    const userId = created.body.userId as string;

    await request(app).delete(`/internal/accounts/${userId}`).set('x-internal-token', internalToken('gateway'));
    const res = await request(app)
      .delete(`/internal/accounts/${userId}`)
      .set('x-internal-token', internalToken('gateway'));
    expect(res.status).toBe(204);
  });
});

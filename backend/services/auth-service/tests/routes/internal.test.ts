import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signInternalToken, verifyAccessToken } from '@glucore/shared';

import { buildTestApp } from '../helpers/app';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

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

async function registerProfessionalViaInternal(body: Record<string, unknown>) {
  return request(app)
    .post('/internal/accounts/professional')
    .set('x-internal-token', internalToken('gateway'))
    .send(body);
}

describe('POST /internal/accounts/professional', () => {
  const professional = () => ({ email: uniqueEmail(), password: STRONG, fullName: 'Dra. Ana Souza' });

  it('rejects a request with no internal token', async () => {
    const res = await request(app).post('/internal/accounts/professional').send(professional());
    expect(res.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  it('ignores a role in the body, creates a HEALTH_PROFESSIONAL and answers 201 { userId, token } (REG-06)', async () => {
    const email = uniqueEmail();
    const res = await registerProfessionalViaInternal({ ...professional(), email, role: 'ADMINISTRATOR' });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['token', 'userId']);
    expect((await prisma.user.findUnique({ where: { email } }))?.role).toBe('HEALTH_PROFESSIONAL');
    expect(verifyAccessToken(res.body.token as string, TEST_JWT_SECRET)).toEqual({
      sub: res.body.userId,
      role: 'HEALTH_PROFESSIONAL',
    });
  });

  it('keeps the patient route creating PATIENT even when the body asks for another role (REG-06)', async () => {
    const email = uniqueEmail();
    const res = await registerViaInternal({ ...professional(), email, role: 'HEALTH_PROFESSIONAL' });

    expect(res.status).toBe(201);
    expect((await prisma.user.findUnique({ where: { email } }))?.role).toBe('PATIENT');
  });

  it('answers 400 WEAK_PASSWORD and 409 EMAIL_TAKEN like the patient registration', async () => {
    const weak = await registerProfessionalViaInternal({ ...professional(), password: 'fraca' });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe('WEAK_PASSWORD');

    const first = professional();
    await registerProfessionalViaInternal(first);
    const taken = await registerProfessionalViaInternal(first);
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('EMAIL_TAKEN');
  });

  it('answers 400 for a body that is not a valid registration', async () => {
    const res = await registerProfessionalViaInternal({ email: 'not-an-email', password: STRONG, fullName: 'Dra. Ana' });
    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
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

describe('POST /internal/accounts/lookup', () => {
  const lookup = (body: unknown, token: string | null = internalToken('gateway')) => {
    const req = request(app).post('/internal/accounts/lookup');
    return (token ? req.set('x-internal-token', token) : req).send(body as object);
  };
  const uuids = (n: number) => Array.from({ length: n }, () => randomUUID());

  it('rejects a request with no internal token', async () => {
    const res = await lookup({ ids: [] }, null);
    expect(res.status).toBe(401);
  });

  it('answers only id and fullName, never email, phone or role (PRO-15, CON-08)', async () => {
    const created = await registerViaInternal({
      email: uniqueEmail(),
      password: STRONG,
      fullName: 'Dra. Ana Souza',
      phone: '11999990000',
    });
    const id = created.body.userId as string;

    const res = await lookup({ ids: [id] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id, fullName: 'Dra. Ana Souza' }]);
  });

  it('leaves out an id with no account', async () => {
    const created = await registerViaInternal({ email: uniqueEmail(), password: STRONG, fullName: 'Conta Real' });
    const known = created.body.userId as string;

    const res = await lookup({ ids: [randomUUID(), known] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: known, fullName: 'Conta Real' }]);
  });

  it('answers each account once when an id is repeated', async () => {
    const created = await registerViaInternal({ email: uniqueEmail(), password: STRONG, fullName: 'Conta Unica' });
    const id = created.body.userId as string;

    const res = await lookup({ ids: [id, id.toUpperCase(), id] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id, fullName: 'Conta Unica' }]);
  });

  it('answers [] for an empty list', async () => {
    const res = await lookup({ ids: [] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('accepts exactly 200 ids and rejects 201 with 400', async () => {
    const atLimit = await lookup({ ids: uuids(200) });
    expect(atLimit.status).toBe(200);
    expect(atLimit.body).toEqual([]);

    const overLimit = await lookup({ ids: uuids(201) });
    expect(overLimit.status).toBe(400);
  });

  it.each([
    ['an id that is not a UUID', { ids: ['not-a-uuid'] }],
    ['one bad id among valid ones', { ids: [randomUUID(), 'x'] }],
    ['a non-string id', { ids: [42] }],
    ['ids that is not a list', { ids: randomUUID() }],
    ['a body with no ids', {}],
  ])('answers 400 for %s', async (_label, body) => {
    const res = await lookup(body);
    expect(res.status).toBe(400);
  });
});

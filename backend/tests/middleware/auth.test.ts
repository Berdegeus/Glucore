import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';

/**
 * Spec: TCC-12 — spec.md "P2: Autorização por papel e sessão inválida tratada"
 * AC1, AC2 and AC4, plus the TOKEN_INVALID / FORBIDDEN_ROLE rows of the
 * design's "Contratos de erro (backend -> app)" table.
 *
 * `src/lib/env.ts` aborts the process when JWT_SECRET is unset, so the secret is
 * set before the middleware module is loaded.
 */

const JWT_SECRET = 'test-secret-for-unit-tests';
process.env.JWT_SECRET = JWT_SECRET;

const { verifyJwt, requireRole } = await import('../../src/middleware/auth.ts');

interface Captured {
  status?: number;
  body?: unknown;
}

function fakeRes(): { res: Response; captured: Captured } {
  const captured: Captured = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
}

function fakeReq(authorization?: string, userId?: string) {
  return { headers: authorization ? { authorization } : {}, userId };
}

function spyNext(): { next: NextFunction; calls: unknown[] } {
  const calls: unknown[] = [];
  return { next: ((err?: unknown) => calls.push(err)) as unknown as NextFunction, calls };
}

describe('verifyJwt — typed 401', () => {
  it('answers 401 TOKEN_INVALID when the Authorization header is absent', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    verifyJwt(fakeReq() as never, res, next);
    assert.equal(captured.status, 401);
    assert.deepEqual(captured.body, { error: 'Unauthorized', code: 'TOKEN_INVALID' });
    assert.equal(calls.length, 0);
  });

  it('answers 401 TOKEN_INVALID when the token cannot be verified', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    verifyJwt(fakeReq('Bearer not-a-real-token') as never, res, next);
    assert.equal(captured.status, 401);
    assert.deepEqual(captured.body, { error: 'Invalid token', code: 'TOKEN_INVALID' });
    assert.equal(calls.length, 0);
  });

  it('accepts a valid token and exposes the subject as userId', () => {
    const token = jwt.sign({ sub: 'user-1' }, JWT_SECRET, { expiresIn: '1h' });
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    const req = fakeReq(`Bearer ${token}`);
    verifyJwt(req as never, res, next);
    assert.equal(captured.status, undefined);
    assert.equal(calls.length, 1);
    assert.equal((req as { userId?: string }).userId, 'user-1');
  });
});

describe("requireRole('PATIENT')", () => {
  it('calls next when the resolved role is allowed', async () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    const middleware = requireRole('PATIENT', { resolveRole: async () => 'PATIENT' });
    middleware(fakeReq(undefined, 'user-1') as never, res, next);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(captured.status, undefined);
    assert.deepEqual(calls, [undefined]);
  });

  it('answers 403 FORBIDDEN_ROLE when the resolved role is not allowed', async () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    const middleware = requireRole('PATIENT', {
      resolveRole: async () => 'HEALTH_PROFESSIONAL',
    });
    middleware(fakeReq(undefined, 'user-1') as never, res, next);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(captured.status, 403);
    assert.deepEqual(captured.body, { error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
    assert.equal(calls.length, 0);
  });

  it('answers 401 TOKEN_INVALID when the authenticated user no longer exists', async () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    const middleware = requireRole('PATIENT', { resolveRole: async () => null });
    middleware(fakeReq(undefined, 'ghost') as never, res, next);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(captured.status, 401);
    assert.deepEqual(captured.body, { error: 'Invalid token', code: 'TOKEN_INVALID' });
    assert.equal(calls.length, 0);
  });

  it('answers 401 TOKEN_INVALID when verifyJwt did not set a userId', async () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    let resolverCalled = false;
    const middleware = requireRole('PATIENT', {
      resolveRole: async () => {
        resolverCalled = true;
        return 'PATIENT';
      },
    });
    middleware(fakeReq() as never, res, next);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(captured.status, 401);
    assert.deepEqual(captured.body, { error: 'Unauthorized', code: 'TOKEN_INVALID' });
    assert.equal(resolverCalled, false);
    assert.equal(calls.length, 0);
  });

  it('accepts any role in the allowed list', async () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    const middleware = requireRole(['PATIENT', 'ADMINISTRATOR'], {
      resolveRole: async () => 'ADMINISTRATOR',
    });
    middleware(fakeReq(undefined, 'user-1') as never, res, next);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(captured.status, undefined);
    assert.deepEqual(calls, [undefined]);
  });

  it('forwards a resolver failure to the error handler instead of answering', async () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    const failure = new Error('database unreachable');
    const middleware = requireRole('PATIENT', {
      resolveRole: async () => {
        throw failure;
      },
    });
    middleware(fakeReq(undefined, 'user-1') as never, res, next);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(captured.status, undefined);
    assert.deepEqual(calls, [failure]);
  });
});

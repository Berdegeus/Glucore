import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';

import { signAccessToken } from '@glucore/shared';

import { requireRole, verifyJwt } from '../../src/middleware/auth';

/**
 * Spec: TCC-12 — spec.md "P2: Autorização por papel e sessão inválida tratada"
 * AC1, AC2 and AC4, plus the TOKEN_INVALID / FORBIDDEN_ROLE rows of the
 * design's "Contratos de erro (backend -> app)" table.
 *
 * Rewritten when authorization moved off the database: `requireRole` used to
 * take a `resolveRole` callback because it queried the `User` table on every
 * request, and the tests injected a fake resolver. The role now arrives on the
 * verified token, so there is nothing left to inject — the fixture is the token
 * itself. The contract these tests defend is unchanged: same statuses, same
 * codes, same precedence.
 *
 * The secret is read per call by `getJwtSecret()`, not at import time, so a
 * plain static import is enough — setting it before the assertions run is all
 * that matters.
 */

const JWT_SECRET = 'test-secret-for-unit-tests';
process.env.JWT_SECRET = JWT_SECRET;

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

function fakeReq(authorization?: string, userId?: string, userRole?: string) {
  return { headers: authorization ? { authorization } : {}, userId, userRole };
}

/** A request as it looks after verifyJwt accepted a token. */
function authenticated(userId: string, userRole: string) {
  return fakeReq(undefined, userId, userRole);
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
    expect(captured.status).toBe(401);
    expect(captured.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    expect(calls.length).toBe(0);
  });

  it('answers 401 TOKEN_INVALID when the token cannot be verified', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    verifyJwt(fakeReq('Bearer not-a-real-token') as never, res, next);
    expect(captured.status).toBe(401);
    expect(captured.body).toEqual({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    expect(calls.length).toBe(0);
  });

  it('accepts a valid token and exposes the subject and the role', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'PATIENT' }, JWT_SECRET);
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    const req = fakeReq(`Bearer ${token}`);
    verifyJwt(req as never, res, next);
    expect(captured.status).toBe(undefined);
    expect(calls.length).toBe(1);
    expect((req as { userId?: string }).userId).toBe('user-1');
    expect((req as { userRole?: string }).userRole).toBe('PATIENT');
  });

  it('answers 401 TOKEN_INVALID for a token minted before the role claim existed', () => {
    // Every token issued before this change had `{sub}` alone. Accepting one
    // would mean guessing a role, and the safe guess does not exist: PATIENT
    // silently downgrades a clinician, anything else hands out access.
    const legacy = jwt.sign({ sub: 'user-1' }, JWT_SECRET, { expiresIn: '30d' });
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    verifyJwt(fakeReq(`Bearer ${legacy}`) as never, res, next);
    expect(captured.status).toBe(401);
    expect(captured.body).toEqual({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    expect(calls.length).toBe(0);
  });
});

describe("requireRole('PATIENT')", () => {
  it('calls next when the role on the token is allowed', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireRole('PATIENT')(authenticated('user-1', 'PATIENT') as never, res, next);
    expect(captured.status).toBe(undefined);
    expect(calls).toEqual([undefined]);
  });

  it('answers 403 FORBIDDEN_ROLE when the role is not allowed', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireRole('PATIENT')(authenticated('user-1', 'HEALTH_PROFESSIONAL') as never, res, next);
    expect(captured.status).toBe(403);
    expect(captured.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
    expect(calls.length).toBe(0);
  });

  it('answers 401 TOKEN_INVALID when verifyJwt did not set a userId', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireRole('PATIENT')(fakeReq() as never, res, next);
    expect(captured.status).toBe(401);
    expect(captured.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    expect(calls.length).toBe(0);
  });

  it('answers 401 TOKEN_INVALID when the request carries a userId but no role', () => {
    // Reachable only by mounting requireRole without verifyJwt in front of it.
    // Answering 403 would suggest the caller is known and merely unauthorized,
    // which is the opposite of what happened.
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireRole('PATIENT')(fakeReq(undefined, 'user-1') as never, res, next);
    expect(captured.status).toBe(401);
    expect(captured.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    expect(calls.length).toBe(0);
  });

  it('accepts any role in the allowed list', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireRole(['PATIENT', 'ADMINISTRATOR'])(
      authenticated('user-1', 'ADMINISTRATOR') as never,
      res,
      next,
    );
    expect(captured.status).toBe(undefined);
    expect(calls).toEqual([undefined]);
  });

  it('is decided end to end by what the token says', () => {
    // The two middlewares in sequence, the way a router mounts them: nothing
    // between the signature and the authorization decision reads a database.
    const token = signAccessToken({ sub: 'user-1', role: 'ADMINISTRATOR' }, JWT_SECRET);
    const req = fakeReq(`Bearer ${token}`);
    const { res, captured } = fakeRes();
    const { next } = spyNext();

    verifyJwt(req as never, res, next);
    requireRole('PATIENT')(req as never, res, next);

    expect(captured.status).toBe(403);
    expect(captured.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
  });
});

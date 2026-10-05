import { describe, expect, it } from 'vitest';
import type { NextFunction, Response } from 'express';

import { createRequireInternalAuth, requireInternalRole, signInternalToken } from '@glucore/shared';

/**
 * Spec: ADM-05 — the internal admin routes check the role again, from the
 * signed internal token, after the gateway already did at the public edge.
 * Mirrors how `requireRole` is tested for the public middleware.
 */

const SECRET = 'internal-secret-for-unit-tests';

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

function spyNext(): { next: NextFunction; calls: unknown[] } {
  const calls: unknown[] = [];
  return { next: ((err?: unknown) => calls.push(err)) as unknown as NextFunction, calls };
}

/** A request as it looks after `requireInternalAuth` accepted a token. */
function identified(internalUserId?: string, internalUserRole?: string) {
  return { headers: {}, internalUserId, internalUserRole };
}

describe("requireInternalRole('ADMINISTRATOR')", () => {
  it('calls next when the role on the internal token is allowed', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireInternalRole('ADMINISTRATOR')(identified('admin-1', 'ADMINISTRATOR') as never, res, next);
    expect(captured.status).toBe(undefined);
    expect(calls).toEqual([undefined]);
  });

  it.each(['PATIENT', 'HEALTH_PROFESSIONAL'])(
    'answers 403 FORBIDDEN_ROLE for a %s identity',
    (role) => {
      const { res, captured } = fakeRes();
      const { next, calls } = spyNext();
      requireInternalRole('ADMINISTRATOR')(identified('user-1', role) as never, res, next);
      expect(captured.status).toBe(403);
      expect(captured.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
      expect(calls.length).toBe(0);
    },
  );

  it('answers 401 TOKEN_INVALID when no identity was set (middleware order mistake)', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireInternalRole('ADMINISTRATOR')(identified() as never, res, next);
    expect(captured.status).toBe(401);
    expect(captured.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    expect(calls.length).toBe(0);
  });

  it('answers 401 TOKEN_INVALID when there is a user id but no role', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireInternalRole('ADMINISTRATOR')(identified('user-1') as never, res, next);
    expect(captured.status).toBe(401);
    expect(captured.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    expect(calls.length).toBe(0);
  });

  it('accepts any role in the allowed list', () => {
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();
    requireInternalRole(['HEALTH_PROFESSIONAL', 'ADMINISTRATOR'])(
      identified('user-1', 'HEALTH_PROFESSIONAL') as never,
      res,
      next,
    );
    expect(captured.status).toBe(undefined);
    expect(calls).toEqual([undefined]);
  });

  it('is decided end to end by what the signed internal token says', () => {
    // The two middlewares in sequence, the way a router mounts them.
    const token = signInternalToken({ sub: 'user-1', role: 'PATIENT' }, SECRET);
    const req = { headers: { 'x-internal-token': token } };
    const { res, captured } = fakeRes();
    const { next, calls } = spyNext();

    createRequireInternalAuth(() => SECRET)(req as never, res, next);
    requireInternalRole('ADMINISTRATOR')(req as never, res, next);

    expect(captured.status).toBe(403);
    expect(captured.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
    expect(calls.length).toBe(1);
  });
});

import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../src/lib/prisma';
import { prismaErrorHandler } from '../../src/middleware/prismaError';
import { MissingEnvError } from '../../src/lib/env';
import { WeakPasswordError } from '../../src/lib/passwordPolicy';

/**
 * This service's link of the error chain.
 *
 * The shared handler is covered by glucose-service's suite; what is asserted
 * here is that auth-service wires the same three classifiers in the same order,
 * and that the two foreign errors only this service can throw —
 * `WeakPasswordError` and `MissingEnvError` — still come out with the contract
 * they carry rather than flattened to 500.
 *
 * The WeakPasswordError case moved here with the password policy itself.
 */

interface Captured {
  status?: number;
  body?: unknown;
}

function handle(error: unknown): Captured {
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
  } as unknown as Response;

  prismaErrorHandler(
    error,
    { method: 'POST', path: '/auth/register' } as Request,
    res,
    (() => {}) as NextFunction,
  );
  return captured;
}

describe('prismaErrorHandler — errors carrying their own contract', () => {
  it('answers a WeakPasswordError with 400 WEAK_PASSWORD', () => {
    const captured = handle(new WeakPasswordError('missingUppercase'));
    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({ error: 'Weak password', code: 'WEAK_PASSWORD' });
  });

  it('answers a MissingEnvError with 500 MISSING_ENV', () => {
    const captured = handle(new MissingEnvError('JWT_SECRET', 'Set it.'));
    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      error: 'JWT_SECRET is not set. Set it.',
      code: 'MISSING_ENV',
    });
  });
});

describe('prismaErrorHandler — Prisma failures', () => {
  it('answers a unique-constraint violation with 409 DUPLICATE_RECORD', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const captured = handle(error);
    expect(captured.status).toBe(409);
    expect(captured.body).toEqual({ error: 'Duplicate record', code: 'DUPLICATE_RECORD' });
  });

  it('answers an unreachable database with 503 DATABASE_UNAVAILABLE', () => {
    const error = new Prisma.PrismaClientInitializationError('cannot reach db', '5.22.0', 'P1001');
    const captured = handle(error);
    expect(captured.status).toBe(503);
    expect(captured.body).toEqual({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' });
  });
});

describe('prismaErrorHandler — unclassified errors', () => {
  it('answers 500 INTERNAL with no stack in the body', () => {
    const captured = handle(new Error('boom'));
    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({ error: 'Internal server error', code: 'INTERNAL' });
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

import { prismaErrorHandler } from '../../src/middleware/prismaError.ts';
import { WeakPasswordError } from '../../src/lib/passwordPolicy.ts';

/**
 * Spec: TCC-09 / TCC-17 — spec.md "P2: Erros de banco com mensagem específica"
 * AC1-AC4 and AC6, plus the WEAK_PASSWORD row of the design's
 * "Contratos de erro (backend -> app)" table.
 *
 * Middlewares are unit-tested with req/res/next doubles (Test Coverage Matrix).
 */

interface Captured {
  status?: number;
  body?: unknown;
}

function fakeRes(headersSent = false): { res: Response; captured: Captured } {
  const captured: Captured = {};
  const res = {
    headersSent,
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

function fakeReq(method = 'POST', originalUrl = '/auth/register'): Request {
  return { method, originalUrl } as unknown as Request;
}

function captureConsoleError(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  return { lines, restore: () => (console.error = original) };
}

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma failure', {
    code,
    clientVersion: '5.22.0',
  });
}

function handle(
  error: unknown,
  options: { headersSent?: boolean; req?: Request } = {},
): { captured: Captured; nextCalls: unknown[]; logs: string[] } {
  const { res, captured } = fakeRes(options.headersSent ?? false);
  const nextCalls: unknown[] = [];
  const next = ((err?: unknown) => nextCalls.push(err)) as unknown as NextFunction;
  const console = captureConsoleError();
  try {
    prismaErrorHandler(error, options.req ?? fakeReq(), res, next);
  } finally {
    console.restore();
  }
  return { captured, nextCalls, logs: console.lines };
}

describe('prismaErrorHandler — classified database failures', () => {
  it('maps P2002 to 409 DUPLICATE_RECORD', () => {
    const { captured } = handle(knownRequestError('P2002'));
    assert.equal(captured.status, 409);
    assert.deepEqual(captured.body, { error: 'Duplicate record', code: 'DUPLICATE_RECORD' });
  });

  it('maps P2003 to 409 RELATED_RECORD_MISSING', () => {
    const { captured } = handle(knownRequestError('P2003'));
    assert.equal(captured.status, 409);
    assert.deepEqual(captured.body, {
      error: 'Related record missing',
      code: 'RELATED_RECORD_MISSING',
    });
  });

  it('maps P2025 to 404 RECORD_NOT_FOUND', () => {
    const { captured } = handle(knownRequestError('P2025'));
    assert.equal(captured.status, 404);
    assert.deepEqual(captured.body, { error: 'Record not found', code: 'RECORD_NOT_FOUND' });
  });

  it('maps P1001 to 503 DATABASE_UNAVAILABLE', () => {
    const { captured } = handle(knownRequestError('P1001'));
    assert.equal(captured.status, 503);
    assert.deepEqual(captured.body, { error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' });
  });

  it('maps P1002 to 503 DATABASE_UNAVAILABLE', () => {
    const { captured } = handle(knownRequestError('P1002'));
    assert.equal(captured.status, 503);
    assert.deepEqual(captured.body, { error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' });
  });

  it('maps PrismaClientInitializationError to 503 DATABASE_UNAVAILABLE', () => {
    const error = new Prisma.PrismaClientInitializationError('cannot reach db', '5.22.0', 'P1001');
    const { captured } = handle(error);
    assert.equal(captured.status, 503);
    assert.deepEqual(captured.body, { error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' });
  });
});

describe('prismaErrorHandler — errors carrying their own contract', () => {
  it('answers a WeakPasswordError with 400 WEAK_PASSWORD', () => {
    const { captured } = handle(new WeakPasswordError('missingUppercase'));
    assert.equal(captured.status, 400);
    assert.deepEqual(captured.body, { error: 'Weak password', code: 'WEAK_PASSWORD' });
  });
});

describe('prismaErrorHandler — unclassified errors', () => {
  it('answers 500 INTERNAL with no stack in the body', () => {
    const { captured } = handle(new Error('boom'));
    assert.equal(captured.status, 500);
    assert.deepEqual(captured.body, { error: 'Internal server error', code: 'INTERNAL' });
  });

  it('answers 500 INTERNAL for an unmapped prisma code', () => {
    const { captured } = handle(knownRequestError('P2000'));
    assert.equal(captured.status, 500);
    assert.deepEqual(captured.body, { error: 'Internal server error', code: 'INTERNAL' });
  });

  it('omits the stack from the log when NODE_ENV is production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const error = new Error('boom');
      const { captured, logs } = handle(error);
      assert.equal(captured.status, 500);
      assert.equal(
        logs.some((line) => line.includes(error.stack!)),
        false,
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe('prismaErrorHandler — logging and delegation', () => {
  it('logs the prisma code and the originating route', () => {
    const { logs } = handle(knownRequestError('P2002'), {
      req: fakeReq('PUT', '/auth/profile'),
    });
    assert.equal(
      logs.some(
        (line) =>
          line.includes('PUT /auth/profile') &&
          line.includes('prismaCode=P2002') &&
          line.includes('code=DUPLICATE_RECORD'),
      ),
      true,
    );
  });

  it('delegates to next when the response already started', () => {
    const error = knownRequestError('P2002');
    const { captured, nextCalls } = handle(error, { headersSent: true });
    assert.equal(captured.status, undefined);
    assert.deepEqual(nextCalls, [error]);
  });
});

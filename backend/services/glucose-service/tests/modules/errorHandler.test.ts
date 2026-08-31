import { describe, expect, it } from 'vitest';
import {
  BadRequestError,
  ConflictError,
  createErrorHandler,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  appErrorClassifier,
  httpContractClassifier,
  type ErrorClassifier,
} from '@glucore/shared';
import type { NextFunction, Request, Response } from 'express';

/**
 * The shared half of the error contract. The Prisma half is covered by
 * tests/middleware/prismaError.test.ts, against the real handler this builds.
 */

function handle(error: unknown, classifiers: ErrorClassifier[]) {
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    headersSent: false,
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  const req = { method: 'POST', originalUrl: '/carbs/item' } as unknown as Request;
  const nextCalls: unknown[] = [];
  const next = ((err?: unknown) => nextCalls.push(err)) as unknown as NextFunction;

  const original = console.error;
  console.error = () => undefined;
  try {
    createErrorHandler(classifiers)(error, req, res, next);
  } finally {
    console.error = original;
  }
  return { ...captured, nextCalls };
}

const DEFAULT_CHAIN = [appErrorClassifier, httpContractClassifier];

describe('createErrorHandler', () => {
  it.each([
    [new BadRequestError('grams must be a number'), 400],
    [new UnauthorizedError('Unauthorized'), 401],
    [new ForbiddenError('Forbidden'), 403],
    [new NotFoundError('not found'), 404],
    [new ConflictError('Duplicate record'), 409],
  ])('answers %s with its own status', (error, status) => {
    expect(handle(error, DEFAULT_CHAIN).status).toBe(status);
  });

  it('omits `code` when the error carries none', () => {
    // The routes answer in two shapes and the suite asserts both with strict
    // equality; adding a code here would silently change a dozen responses.
    expect(handle(new NotFoundError('not found'), DEFAULT_CHAIN).body).toEqual({
      error: 'not found',
    });
  });

  it('includes `code` when the error carries one', () => {
    expect(handle(new BadRequestError('Weak password', 'WEAK_PASSWORD'), DEFAULT_CHAIN).body).toEqual(
      { error: 'Weak password', code: 'WEAK_PASSWORD' },
    );
  });

  it('claims a foreign error that already has a status and a code', () => {
    const foreign = Object.assign(new Error('Weak password'), {
      status: 400,
      code: 'WEAK_PASSWORD',
    });
    expect(handle(foreign, DEFAULT_CHAIN)).toMatchObject({
      status: 400,
      body: { error: 'Weak password', code: 'WEAK_PASSWORD' },
    });
  });

  it('does not claim a foreign error that has a code but no status', () => {
    // A Prisma error has exactly that shape; letting the structural check match
    // it would answer 500 with the raw driver message.
    const prismaLike = Object.assign(new Error('boom'), { code: 'P2002' });
    expect(handle(prismaLike, DEFAULT_CHAIN)).toMatchObject({
      status: 500,
      body: { error: 'Internal server error', code: 'INTERNAL' },
    });
  });

  it('falls back to 500 INTERNAL when no classifier claims the error', () => {
    expect(handle(new Error('boom'), DEFAULT_CHAIN)).toMatchObject({
      status: 500,
      body: { error: 'Internal server error', code: 'INTERNAL' },
    });
  });

  it('stops at the first classifier that claims the error', () => {
    const first: ErrorClassifier = () => ({ status: 418, code: 'FIRST', error: 'first' });
    const second: ErrorClassifier = () => ({ status: 500, code: 'SECOND', error: 'second' });
    expect(handle(new Error('boom'), [first, second]).body).toEqual({
      error: 'first',
      code: 'FIRST',
    });
  });

  it('passes the turn when a classifier returns undefined', () => {
    const abstains: ErrorClassifier = () => undefined;
    expect(handle(new NotFoundError('not found'), [abstains, ...DEFAULT_CHAIN]).status).toBe(404);
  });

  it('delegates instead of answering when the response already started', () => {
    const error = new NotFoundError('not found');
    const captured: { status?: number } = {};
    const res = {
      headersSent: true,
      status(code: number) {
        captured.status = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;
    const nextCalls: unknown[] = [];
    const next = ((err?: unknown) => nextCalls.push(err)) as unknown as NextFunction;

    createErrorHandler(DEFAULT_CHAIN)(
      error,
      { method: 'GET', originalUrl: '/carbs' } as unknown as Request,
      res,
      next,
    );

    expect(captured.status).toBeUndefined();
    expect(nextCalls).toEqual([error]);
  });
});

import { describe, expect, it } from 'vitest';
import { APP_ERROR_KINDS, AppError, isAppError } from './appError';

describe('AppError', () => {
  it('lists exactly the kinds the app distinguishes', () => {
    expect([...APP_ERROR_KINDS]).toEqual([
      'unauthenticated',
      'forbidden',
      'invalid-credentials',
      'rate-limited',
      'unavailable',
      'not-found',
      'validation',
      'conflict',
      'unknown',
    ]);
  });

  it.each(APP_ERROR_KINDS)('builds a %s error', (kind) => {
    const error = new AppError(kind);

    expect(error.kind).toBe(kind);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
  });

  it('leaves code and retryAfterSeconds undefined when not given', () => {
    const error = new AppError('unavailable');

    expect(error.code).toBeUndefined();
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it('keeps the API code, e.g. FORBIDDEN_ROLE on a forbidden error (ACC-05)', () => {
    const error = new AppError('forbidden', { code: 'FORBIDDEN_ROLE' });

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBe('FORBIDDEN_ROLE');
  });

  it('carries retryAfterSeconds for a rate-limited error', () => {
    const error = new AppError('rate-limited', { retryAfterSeconds: 30 });

    expect(error.retryAfterSeconds).toBe(30);
  });
});

describe('isAppError', () => {
  it('accepts an AppError', () => {
    expect(isAppError(new AppError('unknown'))).toBe(true);
  });

  it.each([
    ['a plain Error', new Error('boom')],
    ['a look-alike object', { kind: 'forbidden', code: 'FORBIDDEN_ROLE' }],
    ['a string', 'forbidden'],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isAppError(value)).toBe(false);
  });
});

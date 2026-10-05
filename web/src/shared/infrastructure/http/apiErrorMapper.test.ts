import { describe, expect, it } from 'vitest';
import type { AppErrorKind } from '../../domain/appError';
import { mapApiError } from './apiErrorMapper';

const body = (code?: string) => ({ error: 'message for humans', ...(code ? { code } : {}) });
const noHeaders = new Headers();

interface Case {
  label: string;
  status: number;
  payload: unknown;
  kind: AppErrorKind;
  code: string | undefined;
}

describe('mapApiError: status and code to AppError (ARQ-06)', () => {
  it.each<Case>([
    { label: '401 TOKEN_INVALID ends the session (ACC-09)', status: 401, payload: body('TOKEN_INVALID'), kind: 'unauthenticated', code: 'TOKEN_INVALID' },
    { label: '401 without a code is a failed login (ACC-07)', status: 401, payload: body(), kind: 'invalid-credentials', code: undefined },
    { label: '401 with another code keeps the session', status: 401, payload: body('INVALID_CURRENT_PASSWORD'), kind: 'invalid-credentials', code: 'INVALID_CURRENT_PASSWORD' },
    { label: '403 keeps FORBIDDEN_ROLE (ACC-05)', status: 403, payload: body('FORBIDDEN_ROLE'), kind: 'forbidden', code: 'FORBIDDEN_ROLE' },
    { label: '403 keeps NO_ACTIVE_GRANT', status: 403, payload: body('NO_ACTIVE_GRANT'), kind: 'forbidden', code: 'NO_ACTIVE_GRANT' },
    { label: '404', status: 404, payload: body('RECORD_NOT_FOUND'), kind: 'not-found', code: 'RECORD_NOT_FOUND' },
    { label: '400 keeps the validation code', status: 400, payload: body('INVALID_LAYOUT'), kind: 'validation', code: 'INVALID_LAYOUT' },
    { label: '409', status: 409, payload: body('EMAIL_TAKEN'), kind: 'conflict', code: 'EMAIL_TAKEN' },
    { label: '502', status: 502, payload: null, kind: 'unavailable', code: undefined },
    { label: '503', status: 503, payload: body('DATABASE_UNAVAILABLE'), kind: 'unavailable', code: 'DATABASE_UNAVAILABLE' },
    { label: '504', status: 504, payload: null, kind: 'unavailable', code: undefined },
    { label: '500', status: 500, payload: body('INTERNAL'), kind: 'unknown', code: 'INTERNAL' },
    { label: '501', status: 501, payload: null, kind: 'unknown', code: undefined },
  ])('$label', ({ status, payload, kind, code }) => {
    const error = mapApiError(status, payload, noHeaders);

    expect(error.kind).toBe(kind);
    expect(error.code).toBe(code);
  });

  it.each([
    ['not an object', 'Bad Gateway'],
    ['null', null],
    ['an object whose code is not a string', { error: 'x', code: 42 }],
  ])('leaves code undefined when the body is %s', (_label, payload) => {
    const error = mapApiError(403, payload, noHeaders);

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBeUndefined();
  });
});

describe('mapApiError: 429 and Retry-After (ACC-08)', () => {
  it('reads Retry-After as seconds', () => {
    const error = mapApiError(429, body(), new Headers({ 'Retry-After': '120' }));

    expect(error.kind).toBe('rate-limited');
    expect(error.retryAfterSeconds).toBe(120);
  });

  it('accepts Retry-After: 0', () => {
    const error = mapApiError(429, body(), new Headers({ 'Retry-After': '0' }));

    expect(error.retryAfterSeconds).toBe(0);
  });

  it.each([
    ['absent', noHeaders],
    ['not a number of seconds', new Headers({ 'Retry-After': 'soon' })],
    ['negative', new Headers({ 'Retry-After': '-5' })],
  ])('leaves retryAfterSeconds undefined when Retry-After is %s', (_label, headers) => {
    const error = mapApiError(429, body(), headers);

    expect(error.kind).toBe('rate-limited');
    expect(error.retryAfterSeconds).toBeUndefined();
  });
});

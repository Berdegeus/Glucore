import { describe, expect, expectTypeOf, it } from 'vitest';
import * as z from 'zod';
import { AppError } from '../../domain/appError';
import { parseDto } from './parseDto';

const ENDPOINT = 'GET /api/v1/auth/me';
const MeDto = z.object({ id: z.string(), email: z.string(), role: z.enum(['PATIENT', 'HEALTH_PROFESSIONAL']) });

/** Runs `parseDto` on data expected to be rejected and returns the error. */
function rejectionOf(data: unknown): AppError {
  try {
    parseDto(MeDto, data, ENDPOINT);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error('parseDto accepted invalid data');
}

describe('parseDto (ARQ-07)', () => {
  it('returns valid data, typed by the schema', () => {
    const me = parseDto(MeDto, { id: 'u1', email: 'ana@example.com', role: 'PATIENT' }, ENDPOINT);

    expectTypeOf(me).toEqualTypeOf<{ id: string; email: string; role: 'PATIENT' | 'HEALTH_PROFESSIONAL' }>();
    expect(me).toEqual({ id: 'u1', email: 'ana@example.com', role: 'PATIENT' });
  });

  it('turns a broken contract into an unknown AppError that names the endpoint', () => {
    const error = rejectionOf({ id: 'u1', email: 'ana@example.com', role: 'NURSE' });

    expect(error.kind).toBe('unknown');
    expect(error.message).toContain(ENDPOINT);
  });

  it('keeps the response body out of the error', () => {
    const error = rejectionOf({ id: 'u1', email: 12345678901, role: 'secret-role-value' });

    expect(error.message).not.toContain('12345678901');
    expect(error.message).not.toContain('secret-role-value');
    expect(error.cause).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['an HTML page', '<html>Bad Gateway</html>'],
  ])('rejects a body that is %s', (_label, data) => {
    const error = rejectionOf(data);

    expect(error.kind).toBe('unknown');
    expect(error.message).toContain(ENDPOINT);
    expect(error.message).not.toContain('Bad Gateway');
  });
});

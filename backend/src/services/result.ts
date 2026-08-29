/**
 * Outcome of a service call, in service vocabulary rather than HTTP.
 *
 * The service decides *what* went wrong; the controller decides the status
 * code (design.md "Camadas do backend"). Keeping the two apart is what lets a
 * service be unit-tested without a request or a response object.
 */

export interface InvalidFailure {
  kind: 'invalid';
  message: string;
  /** Present only where the spec requires a machine-readable code (AD-002). */
  code?: string;
}

export interface NotFoundFailure {
  kind: 'notFound';
}

export type Failure = InvalidFailure | NotFoundFailure;

export type Result<T> = { ok: true; value: T } | { ok: false; failure: Failure };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function invalid<T>(message: string, code?: string): Result<T> {
  return { ok: false, failure: { kind: 'invalid', message, ...(code ? { code } : {}) } };
}

export function notFound<T>(): Result<T> {
  return { ok: false, failure: { kind: 'notFound' } };
}

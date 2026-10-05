/** Every failure the app tells apart. Infrastructure maps HTTP statuses onto these. */
export const APP_ERROR_KINDS = [
  'unauthenticated',
  'forbidden',
  'invalid-credentials',
  'rate-limited',
  'unavailable',
  'not-found',
  'validation',
  'conflict',
  'unknown',
] as const;

export type AppErrorKind = (typeof APP_ERROR_KINDS)[number];

export interface AppErrorDetails {
  /** The API's machine-readable `code`, e.g. `FORBIDDEN_ROLE`. */
  code?: string;
  /** From `Retry-After` on a 429. */
  retryAfterSeconds?: number;
}

/** The single error type that crosses layers. */
export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly code: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(kind: AppErrorKind, details: AppErrorDetails = {}) {
    super(details.code ? `${kind}: ${details.code}` : kind);
    this.name = 'AppError';
    this.kind = kind;
    this.code = details.code;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

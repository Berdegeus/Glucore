import { AppError } from './AppError';

/** 400 — the request itself is malformed or fails validation. */
export class BadRequestError extends AppError {
  readonly status = 400;
}

/** 401 — no credential, or one that does not verify. */
export class UnauthorizedError extends AppError {
  readonly status = 401;
}

/** 403 — authenticated, but not allowed to do this. */
export class ForbiddenError extends AppError {
  readonly status = 403;
}

/**
 * 404 — the resource does not exist, or does not belong to the caller.
 *
 * The two cases answer alike on purpose: telling a caller that someone else's
 * record exists is an enumeration oracle.
 */
export class NotFoundError extends AppError {
  readonly status = 404;
}

/** 409 — the write conflicts with the current state (duplicate, lost update). */
export class ConflictError extends AppError {
  readonly status = 409;
}

import { BadRequestError, INVALID_PAGINATION } from '@glucore/shared';

import { UserRole, UserStatus } from '../../lib/prisma';

/** Code carried by a role or status filter that is not an enum value, or a malformed `q`. */
export const INVALID_FILTER = 'INVALID_FILTER';

export const DEFAULT_USERS_PAGE_LIMIT = 25;
export const MAX_USERS_PAGE_LIMIT = 100;

export interface UserListQuery {
  role?: UserRole;
  status?: UserStatus;
  /** Free text matched against name and email, already trimmed; absent when blank. */
  q?: string;
  page: number;
  limit: number;
}

const INTEGER_RE = /^\d+$/;

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
  if (typeof value !== 'string' || !INTEGER_RE.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseEnum<T extends string>(name: string, value: unknown, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new BadRequestError(`${name} must be one of ${allowed.join(', ')}`, INVALID_FILTER);
  }
  return value as T;
}

/**
 * `page` from 1 and `limit` from 1 to 100 (25 when omitted); out of range is a
 * 400, never a silent clamp. An invalid role or status is `INVALID_FILTER`, so a
 * typo in a filter does not quietly list every account.
 */
export function parseUserListQuery(query: {
  role?: unknown;
  status?: unknown;
  q?: unknown;
  page?: unknown;
  limit?: unknown;
}): UserListQuery {
  const role = parseEnum('role', query.role, Object.values(UserRole));
  const status = parseEnum('status', query.status, Object.values(UserStatus));

  let q: string | undefined;
  if (query.q !== undefined) {
    if (typeof query.q !== 'string') {
      throw new BadRequestError('q must be a single text value', INVALID_FILTER);
    }
    q = query.q.trim() || undefined;
  }

  let page = 1;
  if (query.page !== undefined) {
    const parsed = parseInteger(query.page);
    if (parsed === null || parsed < 1) {
      throw new BadRequestError('page must be an integer from 1', INVALID_PAGINATION);
    }
    page = parsed;
  }

  let limit = DEFAULT_USERS_PAGE_LIMIT;
  if (query.limit !== undefined) {
    const parsed = parseInteger(query.limit);
    if (parsed === null || parsed < 1 || parsed > MAX_USERS_PAGE_LIMIT) {
      throw new BadRequestError(
        `limit must be an integer between 1 and ${MAX_USERS_PAGE_LIMIT}`,
        INVALID_PAGINATION,
      );
    }
    limit = parsed;
  }

  return { ...(role ? { role } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}), page, limit };
}

/**
 * Query-string contract shared by the diary listings (spec.md API-03..API-05).
 *
 * `GET /carbs|/insulin|/alerts` accept `before` (exclusive epoch-ms cursor) and
 * `limit` (1..500). A call without either keeps the previous behaviour of
 * returning the 100 most recent entries, so the app in the field does not
 * change while the per-item client is rolled out.
 */

import type { Result } from './result';
import { invalid, ok } from './result';

export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 500;

/** Code carried by every pagination 400, per AD-002. */
export const INVALID_PAGINATION = 'INVALID_PAGINATION';

export interface PageQuery {
  /** Exclusive upper bound in epoch ms; absent means "from the newest". */
  before?: number;
  limit: number;
}

const INTEGER_RE = /^-?\d+$/;

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
  if (typeof value !== 'string' || !INTEGER_RE.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parsePageQuery(query: {
  before?: unknown;
  limit?: unknown;
}): Result<PageQuery> {
  let limit = DEFAULT_PAGE_LIMIT;
  if (query.limit !== undefined) {
    const parsed = parseInteger(query.limit);
    if (parsed === null || parsed < 1 || parsed > MAX_PAGE_LIMIT) {
      return invalid(
        `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
        INVALID_PAGINATION,
      );
    }
    limit = parsed;
  }

  if (query.before === undefined) return ok({ limit });

  const before = parseInteger(query.before);
  if (before === null || before < 0) {
    return invalid('before must be an epoch in milliseconds', INVALID_PAGINATION);
  }
  return ok({ before, limit });
}

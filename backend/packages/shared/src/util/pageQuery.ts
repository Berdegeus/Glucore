import { BadRequestError } from '../errors/httpErrors';

/** Code carried by every pagination 400 — the app decides on it, never on the status alone. */
export const INVALID_PAGINATION = 'INVALID_PAGINATION';

/** No query params keeps the pre-pagination behaviour: the 100 most recent rows. */
export const DEFAULT_PAGE_LIMIT = 100;

/** Upper bound on `limit`, so a caller cannot ask for the whole table in one page. */
export const MAX_PAGE_LIMIT = 500;

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

/**
 * Reads `before`/`limit` off a listing's query string.
 *
 * Shared by carbs, insulin and alerts: the three diary collections page the
 * same way, cursor on the event time, newest first. Readings and settings do
 * not call this — they stay append-only/singleton and keep their fixed cap.
 */
export function parsePageQuery(query: { before?: unknown; limit?: unknown }): PageQuery {
  let limit = DEFAULT_PAGE_LIMIT;
  if (query.limit !== undefined) {
    const parsed = parseInteger(query.limit);
    if (parsed === null || parsed < 1 || parsed > MAX_PAGE_LIMIT) {
      throw new BadRequestError(
        `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
        INVALID_PAGINATION,
      );
    }
    limit = parsed;
  }

  if (query.before === undefined) return { limit };

  const before = parseInteger(query.before);
  if (before === null || before < 0) {
    throw new BadRequestError('before must be an epoch in milliseconds', INVALID_PAGINATION);
  }
  return { before, limit };
}

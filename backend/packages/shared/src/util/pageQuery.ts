import { BadRequestError } from '../errors/httpErrors';

/** Code carried by every pagination 400 — the app decides on it, never on the status alone. */
export const INVALID_PAGINATION = 'INVALID_PAGINATION';

/** No query params keeps the pre-pagination behaviour: the 100 most recent rows. */
export const DEFAULT_PAGE_LIMIT = 100;

/** Upper bound on `limit`, so a caller cannot ask for the whole table in one page. */
export const MAX_PAGE_LIMIT = 500;

export interface PageQuery {
  /** Inclusive lower bound in epoch ms; only listings that opt in read it. */
  from?: number;
  /** Exclusive upper bound in epoch ms; absent means "from the newest". */
  before?: number;
  limit: number;
}

export interface PageQueryOptions {
  /** Rows when `limit` is absent. Defaults to {@link DEFAULT_PAGE_LIMIT}. */
  defaultLimit?: number;
  /** Largest `limit` accepted. Defaults to {@link MAX_PAGE_LIMIT}. */
  maxLimit?: number;
  /** Also read `from`, an inclusive epoch-ms lower bound (a delta sync). */
  from?: boolean;
}

const INTEGER_RE = /^-?\d+$/;

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
  if (typeof value !== 'string' || !INTEGER_RE.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseEpoch(name: string, value: unknown): number {
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 0) {
    throw new BadRequestError(`${name} must be an epoch in milliseconds`, INVALID_PAGINATION);
  }
  return parsed;
}

/**
 * Reads `before`/`limit` (and, on request, `from`) off a listing's query string.
 *
 * Carbs, insulin and alerts page the same way, cursor on the event time, newest
 * first, with the defaults. Readings are the one listing with its own bounds
 * (thousands of rows per page, and `from` for a delta); settings stay a
 * singleton and do not page.
 */
export function parsePageQuery(
  query: { from?: unknown; before?: unknown; limit?: unknown },
  options: PageQueryOptions = {},
): PageQuery {
  const maxLimit = options.maxLimit ?? MAX_PAGE_LIMIT;
  let limit = options.defaultLimit ?? DEFAULT_PAGE_LIMIT;
  if (query.limit !== undefined) {
    const parsed = parseInteger(query.limit);
    if (parsed === null || parsed < 1 || parsed > maxLimit) {
      throw new BadRequestError(
        `limit must be an integer between 1 and ${maxLimit}`,
        INVALID_PAGINATION,
      );
    }
    limit = parsed;
  }

  const page: PageQuery = { limit };
  if (options.from && query.from !== undefined) page.from = parseEpoch('from', query.from);
  if (query.before !== undefined) page.before = parseEpoch('before', query.before);
  return page;
}

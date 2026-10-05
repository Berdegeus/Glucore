import { BadRequestError, INVALID_PAGINATION } from '@glucore/shared';

import { INVALID_DASHBOARD_RANGE, parseTzParam } from '../dashboard/dashboard.schema';
import { DEFAULT_PATIENT_PAGE_LIMIT, MAX_PATIENT_PAGE_LIMIT } from './professional.listing';

/** The periods the portfolio offers, in days. */
export const COHORT_PERIOD_DAYS = [7, 14, 30, 90] as const;
export const DEFAULT_COHORT_DAYS = 14;

export interface CohortQuery {
  days: number;
  /** IANA zone name; shape-checked here, existence is checked against Postgres by the service. */
  tz: string;
}

export interface PatientListQuery extends CohortQuery {
  /** 1-based. */
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

/** `days` is one of 7, 14, 30 or 90 (14 when omitted); anything else is a 400, never a silent clamp. */
export function parseCohortQuery(query: { days?: unknown; tz?: unknown }): CohortQuery {
  let days = DEFAULT_COHORT_DAYS;
  if (query.days !== undefined) {
    const parsed = parseInteger(query.days);
    if (parsed === null || !(COHORT_PERIOD_DAYS as readonly number[]).includes(parsed)) {
      throw new BadRequestError(
        `days must be one of ${COHORT_PERIOD_DAYS.join(', ')}`,
        INVALID_DASHBOARD_RANGE,
      );
    }
    days = parsed;
  }
  return { days, tz: parseTzParam(query.tz) };
}

/**
 * Offset pagination for the portfolio list (PRO-16): `page` from 1, `limit` from
 * 1 to 200 and 50 by default. Out of range is a 400, like the diary lists'
 * `limit`; the cursor parser those use does not fit a list navigated by page number.
 */
export function parsePatientListQuery(query: {
  days?: unknown;
  tz?: unknown;
  page?: unknown;
  limit?: unknown;
}): PatientListQuery {
  let page = 1;
  if (query.page !== undefined) {
    const parsed = parseInteger(query.page);
    if (parsed === null || parsed < 1) {
      throw new BadRequestError('page must be an integer from 1', INVALID_PAGINATION);
    }
    page = parsed;
  }

  let limit = DEFAULT_PATIENT_PAGE_LIMIT;
  if (query.limit !== undefined) {
    const parsed = parseInteger(query.limit);
    if (parsed === null || parsed < 1 || parsed > MAX_PATIENT_PAGE_LIMIT) {
      throw new BadRequestError(
        `limit must be an integer between 1 and ${MAX_PATIENT_PAGE_LIMIT}`,
        INVALID_PAGINATION,
      );
    }
    limit = parsed;
  }

  return { ...parseCohortQuery(query), page, limit };
}

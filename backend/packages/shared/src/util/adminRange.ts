import { BadRequestError } from '../errors/httpErrors';

/** Periods the administrator's overview can show, in days. */
export const ADMIN_RANGE_DAYS = [7, 30, 90] as const;

export const DEFAULT_ADMIN_RANGE_DAYS = 30;

const INTEGER_RE = /^\d+$/;

/**
 * Reads `days` off an admin statistics query: 7, 30 or 90, and 30 when omitted.
 * Anything else is `400 INVALID_DASHBOARD_RANGE`, never a silent clamp: the
 * range also bounds the global scan over the readings table (ADM-02).
 *
 * Shared because three layers read the same query — the gateway, the identity
 * service and the clinical service — and must agree on what is valid.
 */
export function parseAdminRangeDays(value: unknown): number {
  if (value === undefined) return DEFAULT_ADMIN_RANGE_DAYS;

  const days =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && INTEGER_RE.test(value.trim())
        ? Number(value.trim())
        : null;
  if (days === null || !(ADMIN_RANGE_DAYS as readonly number[]).includes(days)) {
    throw new BadRequestError(
      `days must be one of ${ADMIN_RANGE_DAYS.join(', ')}`,
      'INVALID_DASHBOARD_RANGE',
    );
  }
  return days;
}

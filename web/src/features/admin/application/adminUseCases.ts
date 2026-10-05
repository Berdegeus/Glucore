import { AppError } from '../../../shared/domain/appError';
import type { AccountPage, AdminOverview, AdminPeriodDays, AdminRepository, AdminUsersQuery } from '../domain/overview';

/** The periods the administrator can pick, in the order the filter shows them (ADM-07). */
export const ADMIN_PERIOD_DAYS: readonly AdminPeriodDays[] = [7, 30, 90];
/** The period the dashboard opens on. */
export const DEFAULT_ADMIN_DAYS: AdminPeriodDays = 30;

/** The account list's page size (ADM-04). */
export const DEFAULT_USERS_LIMIT = 25;
/** The largest page the API serves. */
export const MAX_USERS_LIMIT = 100;

/** `code` of the `validation` error for a period outside 7, 30 and 90 days; the gateway answers the same code. */
export const INVALID_ADMIN_PERIOD_CODE = 'INVALID_DASHBOARD_RANGE';
/** `code` of the `validation` error for a page or limit out of range; the gateway answers the same code. */
export const INVALID_USERS_PAGINATION_CODE = 'INVALID_PAGINATION';

/** The account list's filters; the page and its size fall back to the first page of 25. */
export type LoadUsersInput = Omit<AdminUsersQuery, 'page' | 'limit'> & { page?: number; limit?: number };

export interface AdminUseCases {
  loadOverview(days: number): Promise<AdminOverview>;
  loadUsers(input?: LoadUsersInput): Promise<AccountPage>;
}

export const isAdminPeriod = (days: number): days is AdminPeriodDays => (ADMIN_PERIOD_DAYS as readonly number[]).includes(days);

function checkPagination(page: number, limit: number): void {
  const pageOk = Number.isInteger(page) && page >= 1;
  const limitOk = Number.isInteger(limit) && limit >= 1 && limit <= MAX_USERS_LIMIT;
  if (!pageOk || !limitOk) throw new AppError('validation', { code: INVALID_USERS_PAGINATION_CODE });
}

/**
 * The administrator's use cases (ADM-01, ADM-04, ADM-07). A period other than
 * 7, 30 or 90 days, or a page out of range, fails with a `validation` error
 * and the repository is never called; the filters go along as given.
 */
export function createAdminUseCases({ admin }: { admin: AdminRepository }): AdminUseCases {
  return {
    async loadOverview(days) {
      if (!isAdminPeriod(days)) throw new AppError('validation', { code: INVALID_ADMIN_PERIOD_CODE });
      return admin.overview(days);
    },
    async loadUsers({ page = 1, limit = DEFAULT_USERS_LIMIT, ...filters } = {}) {
      checkPagination(page, limit);
      return admin.users({ ...filters, page, limit });
    },
  };
}

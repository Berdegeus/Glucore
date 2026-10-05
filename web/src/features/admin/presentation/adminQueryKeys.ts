import type { LoadUsersInput } from '../application/adminUseCases';

/** Every query of the administrator's dashboard starts with this, so one call can reach them all. */
export const ADMIN_KEY = ['admin'] as const;
export const OVERVIEW_KEY = [...ADMIN_KEY, 'overview'] as const;
export const USERS_KEY = [...ADMIN_KEY, 'users'] as const;

/** One cache entry per period: every widget of the period shares it, and a new period is a new request (ADM-07). */
export const overviewQueryKey = (days: number) => [...OVERVIEW_KEY, days] as const;

/** One cache entry per combination of filters, page and page size (ADM-04). */
export const usersQueryKey = ({ role, status, q, page, limit }: LoadUsersInput) =>
  [...USERS_KEY, { role, status, q: q?.trim() || undefined, page, limit }] as const;

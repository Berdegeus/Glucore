import { useQuery, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import type { AppError } from '../../../shared/domain/appError';
import { dashboardQueryOptions } from '../../../shared/presentation/queryClient';
import { DEFAULT_USERS_LIMIT, type LoadUsersInput } from '../application/adminUseCases';
import type { AccountPage, AdminOverview } from '../domain/overview';
import { useAdminServices } from './adminServices';
import { overviewQueryKey, usersQueryKey } from './adminQueryKeys';

/** Every admin query reloads like the rest of the dashboard (PAC-16); `keepPrevious` holds a page until the next arrives. */
function useAdminQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>, keepPrevious = false): UseQueryResult<T, AppError> {
  return useQuery<T, AppError>({ queryKey, queryFn, ...dashboardQueryOptions(keepPrevious) });
}

/**
 * The platform in aggregates over `days` (ADM-01, ADM-07). Every admin widget
 * that asks for the same period shares one request; a new period is a new one.
 */
export function useOverview(days: number): UseQueryResult<AdminOverview, AppError> {
  const { loadOverview } = useAdminServices();
  return useAdminQuery(overviewQueryKey(days), () => loadOverview(days));
}

/**
 * One page of the account list (ADM-04), 25 accounts unless `limit` says
 * otherwise. With `keepPrevious` the page on screen stays until the next one
 * arrives, so a pager or a filter does not blank the table.
 */
export function useUsers(query: LoadUsersInput = {}, keepPrevious = false): UseQueryResult<AccountPage, AppError> {
  const { loadUsers } = useAdminServices();
  const input = { page: 1, limit: DEFAULT_USERS_LIMIT, ...query };
  return useAdminQuery(usersQueryKey(input), () => loadUsers(input), keepPrevious);
}

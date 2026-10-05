import { useQuery, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { AppError } from '../../../shared/domain/appError';
import { REFETCH_INTERVAL_MS } from '../../../shared/presentation/queryClient';
import { useRevokedAccessNotice } from './revokedAccess';

/**
 * What every query of the portfolio shares: it is fresh and reloads every 5
 * minutes while the tab is visible and never while it is hidden (PAC-16), and
 * a `NO_ACTIVE_GRANT` answer goes to the revoked-access notice (PRO-13). Both
 * are set here, not left to the client defaults, so the rule holds under any
 * query client.
 */
export function usePortfolioQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>): UseQueryResult<T, AppError> {
  const { handleError } = useRevokedAccessNotice();
  const query = useQuery<T, AppError>({
    queryKey,
    queryFn,
    staleTime: REFETCH_INTERVAL_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
  const { error } = query;
  useEffect(() => {
    if (error) handleError(error);
  }, [error, handleError]);
  return query;
}

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AppError } from '../../../shared/domain/appError';
import { REFETCH_INTERVAL_MS } from '../../../shared/presentation/queryClient';
import type { DateRange } from '../domain/period';
import type { GlucoseSummary } from '../domain/summary';
import { useSummaryScope, type SummaryScope } from './summaryScope';
import { useSummaryServices } from './summaryServices';

/**
 * Cache key of a summary. The scope is part of it, so the signed-in patient's
 * summary and a linked patient's never share an entry, and neither do two
 * linked patients.
 */
export const summaryQueryKey = (scope: SummaryScope, range: DateRange) =>
  ['summary', scope.patientId ?? null, range.from, range.to] as const;

/**
 * The summary of a period, shared by every widget that asks for it (PAC-17):
 * the same scope and period is one cache entry, so it is one request however
 * many widgets mount, and a widget that mounts later reuses it while it is
 * fresh. It reloads every 5 minutes while the tab is visible and never while
 * it is hidden (PAC-16). Both are set here, not left to the client defaults,
 * so the rule holds under any query client.
 */
export function useSummary(range: DateRange): UseQueryResult<GlucoseSummary, AppError> {
  const { loadPatientSummary } = useSummaryServices();
  const scope = useSummaryScope();
  return useQuery<GlucoseSummary, AppError>({
    queryKey: summaryQueryKey(scope, range),
    queryFn: () => loadPatientSummary(scope.patientId === undefined ? { range } : { range, patientId: scope.patientId }),
    staleTime: REFETCH_INTERVAL_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

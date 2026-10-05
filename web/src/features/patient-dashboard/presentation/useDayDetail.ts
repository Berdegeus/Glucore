import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AppError } from '../../../shared/domain/appError';
import { REFETCH_INTERVAL_MS } from '../../../shared/presentation/queryClient';
import type { DiaryDays } from '../application/loadDayDetail';
import { useDiaryServices } from './diaryServices';

/** Cache key of the loaded diary; "Atualizar" invalidates it together with the summary. */
export const diaryQueryKey = ['diary', 'days'] as const;

/**
 * The diary the day detail reads: readings, carbohydrate and insulin loaded
 * once and cut into local days in memory (PAC-11). It is not tied to the
 * period filter: the day picker offers every day the API still returns. It
 * reloads on the same 5 minute rhythm as the summary, and never while the tab
 * is hidden (PAC-16).
 */
export function useDayDetail(): UseQueryResult<DiaryDays, AppError> {
  const { loadDayDetail } = useDiaryServices();
  return useQuery<DiaryDays, AppError>({
    queryKey: diaryQueryKey,
    queryFn: loadDayDetail,
    staleTime: REFETCH_INTERVAL_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

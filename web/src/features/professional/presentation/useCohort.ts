import type { UseQueryResult } from '@tanstack/react-query';
import type { AppError } from '../../../shared/domain/appError';
import type { CohortSummary } from '../domain/cohort';
import { cohortQueryKey } from './professionalQueryKeys';
import { useProfessionalServices } from './professionalServices';
import { usePortfolioQuery } from './usePortfolioQuery';

/**
 * The portfolio summary over `days`: the KPIs and the charts of the cohort
 * (PRO-05, PRO-09, PRO-10). Every widget that asks for the same period shares
 * one request.
 */
export function useCohort(days: number): UseQueryResult<CohortSummary, AppError> {
  const { loadCohort } = useProfessionalServices();
  return usePortfolioQuery(cohortQueryKey(days), () => loadCohort({ days }));
}

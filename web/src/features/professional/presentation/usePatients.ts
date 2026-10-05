import type { UseQueryResult } from '@tanstack/react-query';
import type { AppError } from '../../../shared/domain/appError';
import { DEFAULT_PAGE_LIMIT } from '../application/professionalUseCases';
import type { PatientPage } from '../domain/cohort';
import { patientsQueryKey } from './professionalQueryKeys';
import { useProfessionalServices } from './professionalServices';
import { usePortfolioQuery } from './usePortfolioQuery';

/**
 * The professional's patients over `days` (PRO-03, PRO-05). A new period, page
 * or page size is a new cache entry and so a new request; with `keepPrevious`
 * the page already on screen stays there until the next one arrives.
 */
export function usePatients(days: number, page = 1, limit = DEFAULT_PAGE_LIMIT, keepPrevious = false): UseQueryResult<PatientPage, AppError> {
  const { loadPatients } = useProfessionalServices();
  return usePortfolioQuery(patientsQueryKey(days, page, limit), () => loadPatients({ days, page, limit }), keepPrevious);
}

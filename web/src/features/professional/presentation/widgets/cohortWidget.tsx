import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AppError } from '../../../../shared/domain/appError';
import { WidgetShell, type WidgetSize, type WidgetState } from '../../../dashboard-layout';
import type { CohortSummary } from '../../domain/cohort';
import { usePeriodDays } from '../periodContext';
import { useCohort } from '../useCohort';

/** The cause every professional widget gives when no patient is linked yet (PRO-01). */
export const NO_PATIENTS_CAUSE = 'Nenhum paciente vinculado';

/** The test of a widget drawn from the cohort: nothing to show while no patient is linked. */
export const hasNoPatients = (cohort: CohortSummary): boolean => cohort.patientCount === 0;

/**
 * The cohort of the page's period, for a widget. Every widget calls this, so
 * they all land on one cache entry: one request however many are on the page.
 */
export function useWidgetCohort(): UseQueryResult<CohortSummary, AppError> {
  return useCohort(usePeriodDays());
}

/**
 * The state of a widget fed by one query. A failed reload that still has data
 * keeps showing it; the error appears only when there is nothing to show.
 */
export function widgetStateOf<T>(query: UseQueryResult<T, AppError>, empty: boolean, cause: string): WidgetState {
  if (query.data) return empty ? { kind: 'empty', cause } : { kind: 'ready' };
  if (query.isError) return { kind: 'error', onRetry: () => void query.refetch() };
  return { kind: 'loading' };
}

interface CohortWidgetProps {
  /** Already resolved text of the card's title. */
  title: string;
  size: WidgetSize;
  /** True when the cohort has no figure for this widget to show. */
  isEmpty: (cohort: CohortSummary) => boolean;
  emptyCause?: string;
  children: (cohort: CohortSummary) => ReactNode;
}

/** What every widget that reads the page's cohort shares: the one request and the card's loading, empty and error states. */
export function CohortWidget({ title, size, isEmpty, emptyCause = NO_PATIENTS_CAUSE, children }: CohortWidgetProps) {
  const query = useWidgetCohort();
  const state = widgetStateOf(query, query.data !== undefined && isEmpty(query.data), emptyCause);
  return (
    <WidgetShell title={title} size={size} state={state}>
      {query.data && children(query.data)}
    </WidgetShell>
  );
}

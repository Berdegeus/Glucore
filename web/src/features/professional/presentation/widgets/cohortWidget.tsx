import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AppError } from '../../../../shared/domain/appError';
import { QueryWidget, type WidgetSize } from '../../../dashboard-layout';
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
  return (
    <QueryWidget query={useWidgetCohort()} title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause}>
      {children}
    </QueryWidget>
  );
}

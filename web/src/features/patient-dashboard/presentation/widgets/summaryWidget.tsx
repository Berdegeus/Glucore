import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AppError } from '../../../../shared/domain/appError';
import { WidgetShell, type WidgetSize, type WidgetState } from '../../../dashboard-layout';
import type { GlucoseSummary } from '../../domain/summary';
import { useWidgetSummary } from '../useWidgetSummary';

/** The cause every patient widget gives when the period has no readings (LAY-16). */
export const NO_READINGS_CAUSE = 'Sem leituras no período';

interface SummaryWidgetProps {
  /** Already resolved text of the card's title. */
  title: string;
  size: WidgetSize;
  /** True when the summary has no figure for this widget to show. */
  isEmpty: (summary: GlucoseSummary) => boolean;
  emptyCause?: string;
  children: (summary: GlucoseSummary) => ReactNode;
}

function stateOf(query: UseQueryResult<GlucoseSummary, AppError>, empty: boolean, cause: string): WidgetState {
  if (query.data) return empty ? { kind: 'empty', cause } : { kind: 'ready' };
  if (query.isError) return { kind: 'error', onRetry: () => void query.refetch() };
  return { kind: 'loading' };
}

/**
 * What every widget that reads the page's summary shares: the one request
 * (PAC-17) and the card's loading, empty and error states. A failed reload
 * that still has data keeps showing it; the error appears only when there is
 * nothing to show.
 */
export function SummaryWidget({ title, size, isEmpty, emptyCause = NO_READINGS_CAUSE, children }: SummaryWidgetProps) {
  const query = useWidgetSummary();
  const state = stateOf(query, query.data !== undefined && isEmpty(query.data), emptyCause);
  return (
    <WidgetShell title={title} size={size} state={state}>
      {query.data && children(query.data)}
    </WidgetShell>
  );
}

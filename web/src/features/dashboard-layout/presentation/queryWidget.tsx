import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AppError } from '../../../shared/domain/appError';
import type { WidgetSize } from '../domain/layout';
import { WidgetShell, type WidgetState } from './widgetShell';

/**
 * The state of a widget fed by one query. A failed reload that still has data
 * keeps showing it; the error appears only when there is nothing to show.
 */
export function queryWidgetState<T>(query: UseQueryResult<T, AppError>, empty: boolean, cause: string): WidgetState {
  if (query.data !== undefined) return empty ? { kind: 'empty', cause } : { kind: 'ready' };
  if (query.isError) return { kind: 'error', onRetry: () => void query.refetch() };
  return { kind: 'loading' };
}

interface QueryWidgetProps<T> {
  query: UseQueryResult<T, AppError>;
  /** Already resolved text of the card's title. */
  title: string;
  size: WidgetSize;
  /** True when the data has no figure for this widget to show. */
  isEmpty: (data: T) => boolean;
  /** Why there is nothing to show, when `isEmpty`. */
  emptyCause: string;
  children: (data: T) => ReactNode;
}

/** What every widget fed by one query shares: the card's loading, empty and error states around the figure it draws once data is there. */
export function QueryWidget<T>({ query, title, size, isEmpty, emptyCause, children }: QueryWidgetProps<T>) {
  const state = queryWidgetState(query, query.data !== undefined && isEmpty(query.data), emptyCause);
  return (
    <WidgetShell title={title} size={size} state={state}>
      {query.data !== undefined && children(query.data)}
    </WidgetShell>
  );
}

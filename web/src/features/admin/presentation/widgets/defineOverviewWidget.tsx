import type { ComponentType, ReactNode } from 'react';
import { QueryWidget, type WidgetProps } from '../../../dashboard-layout';
import type { AdminOverview } from '../../domain/overview';
import { useAdminDays } from '../adminPeriodContext';
import { useOverview } from '../useOverview';

// A count of zero is a figure the administrator reads, not a missing one: the overview never leaves a widget empty.
// SPEC_DEVIATION: T206-T209 ask for an empty state with its cause; these KPIs show "0" instead.
// Reason: decided with the user for Phase 28 — every count of the overview is always present, zero included.
const NEVER_EMPTY = (): boolean => false;

interface OverviewWidgetSpec {
  /** Already resolved text of the card's title. */
  title: string;
  /** The figure, drawn once the overview of the period has loaded. */
  render: (overview: AdminOverview) => ReactNode;
}

/**
 * A widget of the administrator's dashboard: a component that takes the
 * grid's `size` and reads the overview of the page's period inside the
 * loading and error states of `QueryWidget`. Every such widget lands on the
 * one cache entry of the period, so the page makes one request (ADM-07). Only
 * aggregates reach it (ADM-03).
 */
export function defineOverviewWidget({ title, render }: OverviewWidgetSpec): ComponentType<WidgetProps> {
  return function Widget({ size }) {
    const query = useOverview(useAdminDays());
    return (
      <QueryWidget query={query} title={title} size={size} isEmpty={NEVER_EMPTY} emptyCause="">
        {render}
      </QueryWidget>
    );
  };
}

import type { ReactNode } from 'react';
import { QueryWidget, type WidgetSize } from '../../../dashboard-layout';
import type { GlucoseSummary } from '../../domain/summary';
import { useWidgetSummary } from '../useWidgetSummary';

/** The cause every patient widget gives when the period has no readings (LAY-16). */
export const NO_READINGS_CAUSE = 'Sem leituras no período';

/** The test of a widget drawn from glucose readings: nothing to show once the period has none. */
export const hasNoReadings = (summary: GlucoseSummary): boolean => summary.totals.readingsCount === 0;

interface SummaryWidgetProps {
  /** Already resolved text of the card's title. */
  title: string;
  size: WidgetSize;
  /** True when the summary has no figure for this widget to show. */
  isEmpty: (summary: GlucoseSummary) => boolean;
  emptyCause?: string;
  children: (summary: GlucoseSummary) => ReactNode;
}

/**
 * What every widget that reads the page's summary shares: the one request
 * (PAC-17) and the card's loading, empty and error states.
 */
export function SummaryWidget({ title, size, isEmpty, emptyCause = NO_READINGS_CAUSE, children }: SummaryWidgetProps) {
  return (
    <QueryWidget query={useWidgetSummary()} title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause}>
      {children}
    </QueryWidget>
  );
}

import type { ComponentType, ReactNode } from 'react';
import type { WidgetProps } from '../../../dashboard-layout';
import type { GlucoseSummary } from '../../domain/summary';
import { ChartWidget, type ChartAlternative } from './chartWidget';
import { hasNoReadings, SummaryWidget } from './summaryWidget';

// SPEC_DEVIATION: lives in features/patient-dashboard/presentation/widgets, not in shared/presentation/widgets.
// Reason: it assembles the feature's `useWidgetSummary` and the dashboard-layout `WidgetShell`, and a shared module may not import a feature (ARQ-01).

interface SummaryWidgetSpec {
  /** Already resolved text of the card's title. */
  title: string;
  /** True when the summary has no figure for this widget to show. */
  isEmpty: (summary: GlucoseSummary) => boolean;
  /** The cause shown when `isEmpty`; "Sem leituras no período" when absent. */
  emptyCause?: string;
  /** The figure, drawn once the summary has loaded and is not empty. */
  render: (summary: GlucoseSummary) => ReactNode;
}

interface ChartWidgetSpec {
  title: string;
  /** Defaults to "the period has no readings", what most charts key on. */
  isEmpty?: (summary: GlucoseSummary) => boolean;
  emptyCause?: string;
  /** The text and table alternative of the chart `chart` draws (RSP-07). */
  alternative: (summary: GlucoseSummary) => ChartAlternative;
  chart: (summary: GlucoseSummary) => ReactNode;
}

/**
 * The widget every KPI, card and table repeated by hand: a component that
 * takes the grid's `size` and reads the page's one summary (PAC-17) inside the
 * loading, empty and error states of `SummaryWidget`. A widget that needs a
 * hook of its own stays a component that renders `SummaryWidget` itself.
 */
export function defineSummaryWidget({ title, isEmpty, emptyCause, render }: SummaryWidgetSpec): ComponentType<WidgetProps> {
  return function Widget({ size }) {
    return (
      <SummaryWidget title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause}>
        {render}
      </SummaryWidget>
    );
  };
}

/** `defineSummaryWidget` for a figure that is a chart: it goes inside `ChartFrame` with its text and table alternative. */
export function defineChartWidget({ title, isEmpty = hasNoReadings, emptyCause, alternative, chart }: ChartWidgetSpec): ComponentType<WidgetProps> {
  return function Widget({ size }) {
    return (
      <ChartWidget title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause} alternative={alternative}>
        {chart}
      </ChartWidget>
    );
  };
}

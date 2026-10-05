import type { ComponentType, ReactNode } from 'react';
import type { WidgetProps } from '../../../dashboard-layout';
import type { CohortSummary } from '../../domain/cohort';
import { CohortChartWidget, type CohortChartAlternative } from './cohortChartWidget';
import { CohortWidget, hasNoPatients } from './cohortWidget';

interface CohortWidgetSpec {
  /** Already resolved text of the card's title. */
  title: string;
  /** True when the cohort has no figure for this widget to show; "no patient linked" when absent. */
  isEmpty?: (cohort: CohortSummary) => boolean;
  /** The cause shown when `isEmpty`; "Nenhum paciente vinculado" when absent. */
  emptyCause?: string;
  /** The figure, drawn once the cohort has loaded and is not empty. */
  render: (cohort: CohortSummary) => ReactNode;
}

interface CohortChartSpec {
  title: string;
  isEmpty?: (cohort: CohortSummary) => boolean;
  emptyCause?: string;
  /** The text and table alternative of the chart `chart` draws (RSP-07). */
  alternative: (cohort: CohortSummary) => CohortChartAlternative;
  chart: (cohort: CohortSummary) => ReactNode;
}

/**
 * The widget every KPI of the portfolio repeated by hand: a component that
 * takes the grid's `size` and reads the page's one cohort inside the loading,
 * empty and error states of `CohortWidget`.
 */
export function defineCohortWidget({ title, isEmpty = hasNoPatients, emptyCause, render }: CohortWidgetSpec): ComponentType<WidgetProps> {
  return function Widget({ size }) {
    return (
      <CohortWidget title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause}>
        {render}
      </CohortWidget>
    );
  };
}

/** `defineCohortWidget` for a figure that is a chart: it goes inside `ChartFrame` with its text and table alternative. */
export function defineCohortChartWidget({ title, isEmpty = hasNoPatients, emptyCause, alternative, chart }: CohortChartSpec): ComponentType<WidgetProps> {
  return function Widget({ size }) {
    return (
      <CohortChartWidget title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause} alternative={alternative}>
        {chart}
      </CohortChartWidget>
    );
  };
}

import type { ReactNode } from 'react';
import { ChartFrame } from '../../../../shared/presentation/charts/chartFrame';
import type { WidgetSize } from '../../../dashboard-layout';
import type { CohortSummary } from '../../domain/cohort';
import { CohortWidget } from './cohortWidget';

/** What a chart says besides its picture: the sentence for screen readers and the "Ver como tabela" data (RSP-07). */
export interface CohortChartAlternative {
  summary: string;
  columns: readonly string[];
  /** Already formatted for display (pt-BR). */
  rows: ReadonlyArray<readonly string[]>;
}

interface CohortChartWidgetProps {
  title: string;
  size: WidgetSize;
  isEmpty: (cohort: CohortSummary) => boolean;
  emptyCause?: string;
  /** The text and table alternative of the chart `children` draws. */
  alternative: (cohort: CohortSummary) => CohortChartAlternative;
  children: (cohort: CohortSummary) => ReactNode;
}

/** A cohort widget whose figure is a chart inside `ChartFrame`: the states of `CohortWidget` around the chart and its alternatives. */
export function CohortChartWidget({ title, size, isEmpty, emptyCause, alternative, children }: CohortChartWidgetProps) {
  return (
    <CohortWidget title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause}>
      {(cohort) => (
        <ChartFrame title={title} {...alternative(cohort)}>
          {children(cohort)}
        </ChartFrame>
      )}
    </CohortWidget>
  );
}

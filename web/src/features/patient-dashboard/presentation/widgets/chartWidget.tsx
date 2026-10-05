import type { ReactNode } from 'react';
import type { WidgetSize } from '../../../dashboard-layout';
import { ChartFrame } from '../../../../shared/presentation/charts/chartFrame';
import type { GlucoseSummary } from '../../domain/summary';
import { NO_READINGS_CAUSE, SummaryWidget } from './summaryWidget';

/** What a chart says besides its picture: the sentence for screen readers and the "Ver como tabela" data (RSP-07). */
export interface ChartAlternative {
  summary: string;
  columns: readonly string[];
  /** Already formatted for display (pt-BR). */
  rows: ReadonlyArray<readonly string[]>;
  /** Names the table when it needs more than the title, e.g. to say the columns are in different units. */
  tableCaption?: string;
}

interface ChartWidgetProps {
  title: string;
  size: WidgetSize;
  isEmpty: (summary: GlucoseSummary) => boolean;
  emptyCause?: string;
  /** The text and table alternative of the chart `children` draws. */
  alternative: (summary: GlucoseSummary) => ChartAlternative;
  children: (summary: GlucoseSummary) => ReactNode;
}

/** A summary widget whose figure is a chart inside `ChartFrame`: the states of `SummaryWidget` around the chart and its alternatives. */
export function ChartWidget({ title, size, isEmpty, emptyCause = NO_READINGS_CAUSE, alternative, children }: ChartWidgetProps) {
  return (
    <SummaryWidget title={title} size={size} isEmpty={isEmpty} emptyCause={emptyCause}>
      {(summary) => (
        <ChartFrame title={title} {...alternative(summary)}>
          {children(summary)}
        </ChartFrame>
      )}
    </SummaryWidget>
  );
}

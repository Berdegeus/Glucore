import type { ComponentType, ReactNode } from 'react';
import { ChartFrame } from '../../../../shared/presentation/charts/chartFrame';
import { QueryWidget, type WidgetProps } from '../../../dashboard-layout';
import type { AdminOverview } from '../../domain/overview';
import { useAdminDays } from '../adminPeriodContext';
import { useOverview } from '../useOverview';

/** The cause every chart of the administrator gives when the period holds nothing to draw (ADM-02). */
export const NO_DATA_CAUSE = 'Sem dados no período';

/** What a chart says besides its picture: the sentence for screen readers and the "Ver como tabela" data (RSP-07). */
export interface OverviewChartAlternative {
  summary: string;
  columns: readonly string[];
  /** Already formatted for display (pt-BR). */
  rows: ReadonlyArray<readonly string[]>;
}

interface OverviewChartSpec {
  /** Already resolved text of the card's title. */
  title: string;
  /** True when every figure of the chart is zero: there is nothing to draw. */
  isEmpty: (overview: AdminOverview) => boolean;
  alternative: (overview: AdminOverview) => OverviewChartAlternative;
  chart: (overview: AdminOverview) => ReactNode;
}

/**
 * A widget of the administrator whose figure is a chart: it reads the overview
 * of the page's period inside the states of `QueryWidget` and draws the chart
 * inside `ChartFrame`, with its text and table alternative (ADM-02, RSP-07).
 */
export function defineOverviewChartWidget({ title, isEmpty, alternative, chart }: OverviewChartSpec): ComponentType<WidgetProps> {
  return function Widget({ size }) {
    const query = useOverview(useAdminDays());
    return (
      <QueryWidget query={query} title={title} size={size} isEmpty={isEmpty} emptyCause={NO_DATA_CAUSE}>
        {(overview) => (
          <ChartFrame title={title} {...alternative(overview)}>
            {chart(overview)}
          </ChartFrame>
        )}
      </QueryWidget>
    );
  };
}

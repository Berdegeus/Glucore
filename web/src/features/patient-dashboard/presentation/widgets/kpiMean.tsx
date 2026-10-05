import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import type { WidgetProps } from '../../../dashboard-layout';
import { weightedMean } from '../../domain/metrics';
import { SummaryWidget } from './summaryWidget';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { kpiMeanDefinition } from './kpiMean.definition';

export const KPI_MEAN_TITLE = 'Glicose média';

/** Mean glucose of the period in whole mg/dL, each day weighted by its readings (PAC-05). */
export default function KpiMean({ size }: WidgetProps) {
  return (
    <SummaryWidget title={KPI_MEAN_TITLE} size={size} isEmpty={(summary) => weightedMean(summary.byDay) === null}>
      {(summary) => <KpiCard value={weightedMean(summary.byDay)} unit="mg/dL" fractionDigits={0} />}
    </SummaryWidget>
  );
}

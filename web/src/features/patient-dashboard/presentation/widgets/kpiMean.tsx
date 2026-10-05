import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { weightedMean } from '../../domain/metrics';
import { defineSummaryWidget } from './defineSummaryWidget';
import { KPI_MEAN_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { kpiMeanDefinition } from './kpiMean.definition';

export { KPI_MEAN_TITLE };

/** Mean glucose of the period in whole mg/dL, each day weighted by its readings (PAC-05). */
export default defineSummaryWidget({
  title: KPI_MEAN_TITLE,
  isEmpty: (summary) => weightedMean(summary.byDay) === null,
  render: (summary) => <KpiCard value={weightedMean(summary.byDay)} unit="mg/dL" fractionDigits={0} />,
});

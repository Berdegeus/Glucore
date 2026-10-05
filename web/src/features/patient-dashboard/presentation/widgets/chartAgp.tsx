import { RangeAreaChart } from '../../../../shared/presentation/charts/rangeAreaChart';
import { agpAlternative, agpRows } from './agpModel';
import { defineChartWidget } from './defineSummaryWidget';
import { CHART_AGP_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartAgpDefinition } from './chartAgp.definition';

export { CHART_AGP_TITLE };

const OUTER = { minKey: 'p5', maxKey: 'p95', label: 'Percentis 5 a 95' };
const INNER = { minKey: 'p25', maxKey: 'p75', label: 'Percentis 25 a 75' };
const MEDIAN = { key: 'p50', label: 'Mediana' };

/** The glucose of the period folded onto one day: percentile bands and the median by hour (PAC-10). */
export default defineChartWidget({
  title: CHART_AGP_TITLE,
  alternative: (summary) => agpAlternative(summary.agp),
  chart: (summary) => <RangeAreaChart data={agpRows(summary.agp)} xKey="hour" outer={OUTER} inner={INNER} median={MEDIAN} />,
});

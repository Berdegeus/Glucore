import { RangeAreaChart } from '../../../../shared/presentation/charts/rangeAreaChart';
import type { WidgetProps } from '../../../dashboard-layout';
import { agpAlternative, agpRows } from './agpModel';
import { ChartWidget } from './chartWidget';
import { hasNoReadings } from './summaryWidget';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartAgpDefinition } from './chartAgp.definition';

export const CHART_AGP_TITLE = 'Perfil ambulatorial (AGP)';

const OUTER = { minKey: 'p5', maxKey: 'p95', label: 'Percentis 5 a 95' };
const INNER = { minKey: 'p25', maxKey: 'p75', label: 'Percentis 25 a 75' };
const MEDIAN = { key: 'p50', label: 'Mediana' };

/** The glucose of the period folded onto one day: percentile bands and the median by hour (PAC-10). */
export default function ChartAgp({ size }: WidgetProps) {
  return (
    <ChartWidget title={CHART_AGP_TITLE} size={size} isEmpty={hasNoReadings} alternative={(summary) => agpAlternative(summary.agp)}>
      {(summary) => <RangeAreaChart data={agpRows(summary.agp)} xKey="hour" outer={OUTER} inner={INNER} median={MEDIAN} />}
    </ChartWidget>
  );
}

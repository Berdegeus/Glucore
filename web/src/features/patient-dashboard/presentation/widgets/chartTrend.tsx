import { LineBandChart } from '../../../../shared/presentation/charts/lineBandChart';
import type { WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { hasNoReadings } from './summaryWidget';
import { DEFAULT_TARGET_RANGE, trendAlternative, trendRows } from './trendModel';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartTrendDefinition } from './chartTrend.definition';

export const CHART_TREND_TITLE = 'Tendência da glicose';

const LINES = [
  { key: 'avg', label: 'Média diária' },
  { key: 'movingAvg', label: 'Média móvel de 7 dias', dashed: true },
];
const BAND = { minKey: 'min', maxKey: 'max', label: 'Mínimo a máximo' };
const TARGET = { ...DEFAULT_TARGET_RANGE, label: `Faixa-alvo (${DEFAULT_TARGET_RANGE.low} a ${DEFAULT_TARGET_RANGE.high} mg/dL)` };

/** Daily mean with its min-max band, the 7-day moving average and the target range (PAC-06). */
export default function ChartTrend({ size }: WidgetProps) {
  return (
    <ChartWidget title={CHART_TREND_TITLE} size={size} isEmpty={hasNoReadings} alternative={(summary) => trendAlternative(summary.byDay)}>
      {(summary) => <LineBandChart data={trendRows(summary.byDay)} xKey="day" lines={LINES} band={BAND} targetRange={TARGET} />}
    </ChartWidget>
  );
}

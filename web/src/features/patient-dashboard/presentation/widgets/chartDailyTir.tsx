import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatPercent } from '../../../../shared/presentation/format';
import type { WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { dailyTirAlternative, dailyTirRows } from './dailyTirModel';
import { hasNoReadings } from './summaryWidget';
import { CHART_DAILY_TIR_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartDailyTirDefinition } from './chartDailyTir.definition';

export { CHART_DAILY_TIR_TITLE };

const SERIES = [{ key: 'tir', label: 'Tempo no alvo' }];
const PERCENT_DOMAIN = [0, 100] as const;
const formatTick = (value: number) => formatPercent(value, 0);

/** Percentage of each day's readings inside the target range (PAC-07). */
export default function ChartDailyTir({ size }: WidgetProps) {
  return (
    <ChartWidget title={CHART_DAILY_TIR_TITLE} size={size} isEmpty={hasNoReadings} alternative={(summary) => dailyTirAlternative(summary.byDay)}>
      {(summary) => (
        <BarChart data={dailyTirRows(summary.byDay)} categoryKey="day" series={SERIES} domain={PERCENT_DOMAIN} formatValue={formatTick} />
      )}
    </ChartWidget>
  );
}

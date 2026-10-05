import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatPercent } from '../../../../shared/presentation/format';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { dailyTirAlternative, dailyTirRows } from './dailyTirModel';
import { hasNoReadings } from './summaryWidget';

export const CHART_DAILY_TIR_TITLE = 'Tempo no alvo por dia';

export const chartDailyTirDefinition: WidgetDefinition = {
  id: 'chart-daily-tir',
  titleKey: 'widget.chart-daily-tir',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

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

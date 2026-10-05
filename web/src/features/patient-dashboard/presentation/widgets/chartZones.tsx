import { StackedBarChart } from '../../../../shared/presentation/charts/stackedBarChart';
import { formatPercent } from '../../../../shared/presentation/format';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { hasNoReadings } from './summaryWidget';
import { ZONE_SEGMENTS, zonesAlternative, zonesRow } from './zonesModel';

export const CHART_ZONES_TITLE = 'Tempo por zona de glicose';

export const chartZonesDefinition: WidgetDefinition = {
  id: 'chart-zones',
  titleKey: 'widget.chart-zones',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

const PERCENT_DOMAIN = [0, 100] as const;
const BAR_HEIGHT = 140;
const formatTick = (value: number) => formatPercent(value, 0);

/** The share of readings in each of the five zones, as one horizontal stacked bar (PAC-10). */
export default function ChartZones({ size }: WidgetProps) {
  return (
    <ChartWidget title={CHART_ZONES_TITLE} size={size} isEmpty={hasNoReadings} alternative={(summary) => zonesAlternative(summary.zoneDistribution)}>
      {(summary) => (
        <StackedBarChart
          data={[zonesRow(summary.zoneDistribution)]}
          categoryKey="period"
          segments={ZONE_SEGMENTS}
          orientation="horizontal"
          domain={PERCENT_DOMAIN}
          height={BAR_HEIGHT}
          formatValue={formatTick}
        />
      )}
    </ChartWidget>
  );
}

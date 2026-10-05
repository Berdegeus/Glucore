import { HeatmapChart } from '../../../../shared/presentation/charts/heatmapChart';
import { formatMgdl } from '../../../../shared/presentation/format';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { heatmapAlternative, heatmapCells, WEEKDAY_LABELS } from './heatmapCells';
import { hasNoReadings } from './summaryWidget';

export const CHART_HEATMAP_TITLE = 'Glicose por dia da semana e hora';

export const chartHeatmapDefinition: WidgetDefinition = {
  id: 'chart-heatmap',
  titleKey: 'widget.chart-heatmap',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

/** Mean glucose of each weekday and hour of the period, darker where it is higher (PAC-10). */
export default function ChartHeatmap({ size }: WidgetProps) {
  return (
    <ChartWidget title={CHART_HEATMAP_TITLE} size={size} isEmpty={hasNoReadings} alternative={(summary) => heatmapAlternative(summary.heatmap)}>
      {(summary) => <HeatmapChart cells={heatmapCells(summary.heatmap)} dayLabels={WEEKDAY_LABELS} formatValue={formatMgdl} />}
    </ChartWidget>
  );
}

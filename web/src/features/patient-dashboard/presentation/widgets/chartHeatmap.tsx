import { HeatmapChart } from '../../../../shared/presentation/charts/heatmapChart';
import { formatMgdl } from '../../../../shared/presentation/format';
import type { WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { heatmapAlternative, heatmapCells, WEEKDAY_LABELS } from './heatmapCells';
import { hasNoReadings } from './summaryWidget';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartHeatmapDefinition } from './chartHeatmap.definition';

export const CHART_HEATMAP_TITLE = 'Glicose por dia da semana e hora';

/** Mean glucose of each weekday and hour of the period, darker where it is higher (PAC-10). */
export default function ChartHeatmap({ size }: WidgetProps) {
  return (
    <ChartWidget title={CHART_HEATMAP_TITLE} size={size} isEmpty={hasNoReadings} alternative={(summary) => heatmapAlternative(summary.heatmap)}>
      {(summary) => <HeatmapChart cells={heatmapCells(summary.heatmap)} dayLabels={WEEKDAY_LABELS} formatValue={formatMgdl} />}
    </ChartWidget>
  );
}

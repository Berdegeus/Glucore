import { HeatmapChart } from '../../../../shared/presentation/charts/heatmapChart';
import { formatMgdl } from '../../../../shared/presentation/format';
import { defineChartWidget } from './defineSummaryWidget';
import { heatmapAlternative, heatmapCells, WEEKDAY_LABELS } from './heatmapCells';
import { CHART_HEATMAP_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartHeatmapDefinition } from './chartHeatmap.definition';

export { CHART_HEATMAP_TITLE };

/** Mean glucose of each weekday and hour of the period, darker where it is higher (PAC-10). */
export default defineChartWidget({
  title: CHART_HEATMAP_TITLE,
  alternative: (summary) => heatmapAlternative(summary.heatmap),
  chart: (summary) => <HeatmapChart cells={heatmapCells(summary.heatmap)} dayLabels={WEEKDAY_LABELS} formatValue={formatMgdl} />,
});

import { StackedBarChart } from '../../../../shared/presentation/charts/stackedBarChart';
import { formatPercent } from '../../../../shared/presentation/format';
import { defineChartWidget } from './defineSummaryWidget';
import { ZONE_SEGMENTS, zonesAlternative, zonesRow } from './zonesModel';
import { CHART_ZONES_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartZonesDefinition } from './chartZones.definition';

export { CHART_ZONES_TITLE };

const PERCENT_DOMAIN = [0, 100] as const;
const BAR_HEIGHT = 140;
const formatTick = (value: number) => formatPercent(value, 0);

/** The share of readings in each of the five zones, as one horizontal stacked bar (PAC-10). */
export default defineChartWidget({
  title: CHART_ZONES_TITLE,
  alternative: (summary) => zonesAlternative(summary.zoneDistribution),
  chart: (summary) => (
    <StackedBarChart
      data={[zonesRow(summary.zoneDistribution)]}
      categoryKey="period"
      segments={ZONE_SEGMENTS}
      orientation="horizontal"
      domain={PERCENT_DOMAIN}
      height={BAR_HEIGHT}
      formatValue={formatTick}
    />
  ),
});

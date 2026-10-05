import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatNumber } from '../../../../shared/presentation/format';
import type { WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { insulinTypeAlternative, insulinTypeRows } from './insulinTypeModel';
import { CHART_INSULIN_TYPE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartInsulinTypeDefinition } from './chartInsulinType.definition';

export { CHART_INSULIN_TYPE_TITLE };

/** The cause when the diary has no insulin in the period: readings do not matter to this card. */
export const NO_INSULIN_CAUSE = 'Nenhum registro de insulina no período';

const SERIES = [{ key: 'units', label: 'Insulina total (U)' }];
const formatUnitsTick = (value: number) => formatNumber(value, 1);

/** Total units of insulin logged in the period, one bar per type, with the count of records in the table (PAC-09). */
export default function ChartInsulinType({ size }: WidgetProps) {
  return (
    <ChartWidget
      title={CHART_INSULIN_TYPE_TITLE}
      size={size}
      isEmpty={(summary) => summary.insulinByType.length === 0}
      emptyCause={NO_INSULIN_CAUSE}
      alternative={(summary) => insulinTypeAlternative(summary.insulinByType)}
    >
      {(summary) => <BarChart data={insulinTypeRows(summary.insulinByType)} categoryKey="type" series={SERIES} formatValue={formatUnitsTick} />}
    </ChartWidget>
  );
}

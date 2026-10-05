import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatNumber } from '../../../../shared/presentation/format';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { ChartWidget } from './chartWidget';
import { insulinTypeAlternative, insulinTypeRows } from './insulinTypeModel';

export const CHART_INSULIN_TYPE_TITLE = 'Insulina por tipo';

/** The cause when the diary has no insulin in the period: readings do not matter to this card. */
export const NO_INSULIN_CAUSE = 'Nenhum registro de insulina no período';

export const chartInsulinTypeDefinition: WidgetDefinition = {
  id: 'chart-insulin-type',
  titleKey: 'widget.chart-insulin-type',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

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

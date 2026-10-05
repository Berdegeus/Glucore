import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { alertsTypeAlternative, alertsTypeRows } from './alertsTypeModel';
import { ChartWidget } from './chartWidget';

export const CHART_ALERTS_TYPE_TITLE = 'Alertas por tipo';

/** The cause when no alert fired in the period: readings do not matter to this card. */
export const NO_ALERTS_CAUSE = 'Nenhum alerta no período';

export const chartAlertsTypeDefinition: WidgetDefinition = {
  id: 'chart-alerts-type',
  titleKey: 'widget.chart-alerts-type',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

const SERIES = [{ key: 'count', label: 'Alertas' }];

/** How many alerts of each type fired in the period (PAC-09). */
export default function ChartAlertsType({ size }: WidgetProps) {
  return (
    <ChartWidget
      title={CHART_ALERTS_TYPE_TITLE}
      size={size}
      isEmpty={(summary) => summary.alertsByType.length === 0}
      emptyCause={NO_ALERTS_CAUSE}
      alternative={(summary) => alertsTypeAlternative(summary.alertsByType)}
    >
      {(summary) => <BarChart data={alertsTypeRows(summary.alertsByType)} categoryKey="type" series={SERIES} />}
    </ChartWidget>
  );
}

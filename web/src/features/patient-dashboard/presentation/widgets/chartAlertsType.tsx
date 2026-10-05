import { BarChart } from '../../../../shared/presentation/charts/barChart';
import type { WidgetProps } from '../../../dashboard-layout';
import { alertsTypeAlternative, alertsTypeRows } from './alertsTypeModel';
import { ChartWidget } from './chartWidget';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartAlertsTypeDefinition } from './chartAlertsType.definition';

export const CHART_ALERTS_TYPE_TITLE = 'Alertas por tipo';

/** The cause when no alert fired in the period: readings do not matter to this card. */
export const NO_ALERTS_CAUSE = 'Nenhum alerta no período';

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

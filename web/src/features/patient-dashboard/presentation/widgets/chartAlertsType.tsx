import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { alertsTypeAlternative, alertsTypeRows } from './alertsTypeModel';
import { defineChartWidget } from './defineSummaryWidget';
import { CHART_ALERTS_TYPE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartAlertsTypeDefinition } from './chartAlertsType.definition';

export { CHART_ALERTS_TYPE_TITLE };

/** The cause when no alert fired in the period: readings do not matter to this card. */
export const NO_ALERTS_CAUSE = 'Nenhum alerta no período';

const SERIES = [{ key: 'count', label: 'Alertas' }];

/** How many alerts of each type fired in the period (PAC-09). */
export default defineChartWidget({
  title: CHART_ALERTS_TYPE_TITLE,
  isEmpty: (summary) => summary.alertsByType.length === 0,
  emptyCause: NO_ALERTS_CAUSE,
  alternative: (summary) => alertsTypeAlternative(summary.alertsByType),
  chart: (summary) => <BarChart data={alertsTypeRows(summary.alertsByType)} categoryKey="type" series={SERIES} />,
});

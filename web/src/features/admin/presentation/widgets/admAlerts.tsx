import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatNumber } from '../../../../shared/presentation/format';
import { defineOverviewChartWidget } from './defineOverviewChartWidget';
import { alertAlternative, alertRows, allZero } from './overviewChartModels';
import { ADM_ALERTS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { admAlertsDefinition } from './admAlerts.definition';

export { ADM_ALERTS_TITLE };

const SERIES = [{ key: 'count', label: 'Alertas' }];
const formatCount = (value: number) => formatNumber(value, 0);

/** How many alerts of each type fired on the platform in the period, named as the patient reads them (ADM-02). */
export default defineOverviewChartWidget({
  title: ADM_ALERTS_TITLE,
  isEmpty: ({ alertsByType }) => allZero(alertsByType),
  alternative: alertAlternative,
  chart: (overview) => <BarChart data={alertRows(overview)} categoryKey="type" series={SERIES} formatValue={formatCount} />,
});

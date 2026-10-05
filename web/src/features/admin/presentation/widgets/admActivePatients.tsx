import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatNumber } from '../../../../shared/presentation/format';
import { defineOverviewChartWidget } from './defineOverviewChartWidget';
import { activeAlternative, activeRows, allZero } from './overviewChartModels';
import { ADM_ACTIVE_PATIENTS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { admActivePatientsDefinition } from './admActivePatients.definition';

export { ADM_ACTIVE_PATIENTS_TITLE };

const SERIES = [{ key: 'count', label: 'Pacientes' }];
const formatCount = (value: number) => formatNumber(value, 0);

/** Patients registered next to those with a reading in the last 24 hours and in the last 7 days (ADM-02). */
export default defineOverviewChartWidget({
  title: ADM_ACTIVE_PATIENTS_TITLE,
  isEmpty: ({ activePatients }) => allZero([{ count: activePatients.registered }, { count: activePatients.last24h }, { count: activePatients.last7d }]),
  alternative: activeAlternative,
  chart: (overview) => <BarChart data={activeRows(overview)} categoryKey="group" series={SERIES} formatValue={formatCount} />,
});

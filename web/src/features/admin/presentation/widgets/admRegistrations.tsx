import { LineBandChart } from '../../../../shared/presentation/charts/lineBandChart';
import { defineOverviewChartWidget } from './defineOverviewChartWidget';
import { allZero, dayAlternative, dayRows } from './overviewChartModels';
import { ADM_REGISTRATIONS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { admRegistrationsDefinition } from './admRegistrations.definition';

export { ADM_REGISTRATIONS_TITLE };

const LINES = [{ key: 'count', label: 'Cadastros' }];

/** How many accounts were created on each day of the period (ADM-02). */
export default defineOverviewChartWidget({
  title: ADM_REGISTRATIONS_TITLE,
  isEmpty: ({ registrationsByDay }) => allZero(registrationsByDay),
  alternative: ({ registrationsByDay }) => dayAlternative('Cadastros por dia', 'Cadastros', registrationsByDay),
  chart: ({ registrationsByDay }) => <LineBandChart data={dayRows(registrationsByDay)} xKey="day" lines={LINES} />,
});

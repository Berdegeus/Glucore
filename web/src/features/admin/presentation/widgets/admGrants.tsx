import { LineBandChart } from '../../../../shared/presentation/charts/lineBandChart';
import { defineOverviewChartWidget } from './defineOverviewChartWidget';
import { allZero, weekAlternative, weekRows } from './overviewChartModels';
import { ADM_GRANTS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { admGrantsDefinition } from './admGrants.definition';

export { ADM_GRANTS_TITLE };

const LINES = [{ key: 'count', label: 'Vínculos criados' }];

/** How many patient-to-professional links were created in each week of the period (ADM-02). */
export default defineOverviewChartWidget({
  title: ADM_GRANTS_TITLE,
  isEmpty: ({ grants }) => allZero(grants.createdByWeek),
  alternative: weekAlternative,
  chart: (overview) => <LineBandChart data={weekRows(overview)} xKey="week" lines={LINES} />,
});

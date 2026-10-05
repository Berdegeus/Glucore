import { DonutChart } from '../../../../shared/presentation/charts/donutChart';
import { defineOverviewChartWidget } from './defineOverviewChartWidget';
import { allZero, roleAlternative, roleSlices } from './overviewChartModels';
import { ADM_USERS_ROLE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { admUsersRoleDefinition } from './admUsersRole.definition';

export { ADM_USERS_ROLE_TITLE };

/** How the accounts split among patients, health professionals and administrators (ADM-02). */
export default defineOverviewChartWidget({
  title: ADM_USERS_ROLE_TITLE,
  isEmpty: ({ accounts }) => allZero(accounts.byRole),
  alternative: roleAlternative,
  chart: (overview) => <DonutChart slices={roleSlices(overview)} />,
});

import { registerWidget, registerWidgetTitles } from '../../dashboard-layout';
import { admKpiAccountsDefinition } from './widgets/admKpiAccounts.definition';
import { admKpiActivePatientsDefinition } from './widgets/admKpiActivePatients.definition';
import { admKpiGrantsDefinition } from './widgets/admKpiGrants.definition';
import { admKpiRegistrationsDefinition } from './widgets/admKpiRegistrations.definition';
import { admRegistrationsDefinition } from './widgets/admRegistrations.definition';
import { admUsersRoleDefinition } from './widgets/admUsersRole.definition';
import { admUsersTableDefinition } from './widgets/admUsersTable.definition';
import { ADMIN_WIDGET_TITLES } from './widgets/widgetTitles';

// The administrator's widgets, in the order of `contracts/widget-catalog.json`. A new
// widget is one module under `widgets/` and one line here (ARQ-10); the grid
// and the page never learn which widgets exist. The title of a widget is one
// entry in `widgets/widgetTitles.ts`.
// The contract lists four more (`adm-active-patients`, `adm-readings-volume`, `adm-grants`, `adm-alerts`): they
// were deferred by decision of the user and are not registered, so the picker and the grid never offer them.
registerWidgetTitles(ADMIN_WIDGET_TITLES);
registerWidget(admKpiAccountsDefinition, () => import('./widgets/admKpiAccounts'));
registerWidget(admKpiRegistrationsDefinition, () => import('./widgets/admKpiRegistrations'));
registerWidget(admKpiActivePatientsDefinition, () => import('./widgets/admKpiActivePatients'));
registerWidget(admKpiGrantsDefinition, () => import('./widgets/admKpiGrants'));
registerWidget(admUsersRoleDefinition, () => import('./widgets/admUsersRole'));
registerWidget(admRegistrationsDefinition, () => import('./widgets/admRegistrations'));
registerWidget(admUsersTableDefinition, () => import('./widgets/admUsersTable'));

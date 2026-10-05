import { overviewOf, zeroOverviewOf } from '../../../../test/adminFakes';
import { describeAdminFigure, describeAdminWidget } from '../../../../test/adminWidgetHarness';
import AdmKpiRegistrations, { ADM_KPI_REGISTRATIONS_TITLE, admKpiRegistrationsDefinition } from './admKpiRegistrations';

describeAdminWidget({ Widget: AdmKpiRegistrations, definition: admKpiRegistrationsDefinition, title: ADM_KPI_REGISTRATIONS_TITLE, shown: '9' });

describeAdminFigure({
  Widget: AdmKpiRegistrations,
  title: 'Cadastros no período',
  requirement: 'ADM-01',
  samples: [
    { name: 'shows the registrations of the period and what they count', overview: overviewOf(), shown: ['9', 'contas novas no período'] },
    { name: 'shows a large count whole', overview: overviewOf({ registrationsInPeriod: 3045 }), shown: ['3045'] },
    { name: 'shows 0, not an empty state, when nobody registered', overview: zeroOverviewOf(), shown: ['0', 'contas novas no período'] },
  ],
});

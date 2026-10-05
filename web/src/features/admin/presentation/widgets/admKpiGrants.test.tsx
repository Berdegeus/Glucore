import { overviewOf, zeroOverviewOf } from '../../../../test/adminFakes';
import { describeAdminFigure, describeAdminWidget } from '../../../../test/adminWidgetHarness';
import AdmKpiGrants, { ADM_KPI_GRANTS_TITLE, admKpiGrantsDefinition } from './admKpiGrants';

describeAdminWidget({ Widget: AdmKpiGrants, definition: admKpiGrantsDefinition, title: ADM_KPI_GRANTS_TITLE, shown: '14' });

describeAdminFigure({
  Widget: AdmKpiGrants,
  title: 'Vínculos ativos',
  requirement: 'ADM-01',
  samples: [
    { name: 'shows the active links and between whom they are', overview: overviewOf(), shown: ['14', 'entre pacientes e profissionais'] },
    {
      name: 'reads the active links, not the ones created in the period',
      overview: overviewOf({ grants: { active: 870, createdByWeek: [{ weekStart: '2026-08-03', count: 5 }] } }),
      shown: ['870'],
    },
    { name: 'shows 0, not an empty state, when no link is active', overview: zeroOverviewOf(), shown: ['0', 'entre pacientes e profissionais'] },
  ],
});

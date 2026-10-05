import { overviewOf, zeroOverviewOf } from '../../../../test/adminFakes';
import { describeAdminFigure, describeAdminWidget } from '../../../../test/adminWidgetHarness';
import AdmKpiActivePatients, { ADM_KPI_ACTIVE_PATIENTS_TITLE, admKpiActivePatientsDefinition } from './admKpiActivePatients';

describeAdminWidget({ Widget: AdmKpiActivePatients, definition: admKpiActivePatientsDefinition, title: ADM_KPI_ACTIVE_PATIENTS_TITLE, shown: '18' });

describeAdminFigure({
  Widget: AdmKpiActivePatients,
  title: 'Pacientes ativos',
  requirement: 'ADM-01',
  samples: [
    {
      name: 'shows the patients active in 24 h and in 7 days, out of those registered',
      overview: overviewOf(),
      shown: ['18', 'em 24 h', '27 em 7 dias · de 35 cadastrados'],
    },
    {
      name: 'keeps each window apart when they differ widely',
      overview: overviewOf({ activePatients: { last24h: 3, last7d: 1500, registered: 2000 } }),
      shown: ['3', '1500 em 7 dias · de 2000 cadastrados'],
    },
    { name: 'shows 0, not an empty state, when no patient synced', overview: zeroOverviewOf(), shown: ['0', '0 em 7 dias · de 0 cadastrados'] },
  ],
});

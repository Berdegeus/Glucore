import { describeCohortFigure, describeCohortWidget } from '../../../../test/professionalWidgetHarness';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import ProKpiPatients, { PRO_KPI_PATIENTS_TITLE, proKpiPatientsDefinition } from './proKpiPatients';

describeCohortWidget({ Widget: ProKpiPatients, definition: proKpiPatientsDefinition, title: PRO_KPI_PATIENTS_TITLE, shown: '2' });

describeCohortFigure({
  Widget: ProKpiPatients,
  title: 'Pacientes vinculados',
  withValue: (value) => cohortSummaryOf({ patientCount: value ?? 0 }),
  samples: [
    { value: 1, shown: '1' },
    { value: 12, shown: '12' },
    { value: 150, shown: '150' },
  ],
  requirement: 'PRO-09',
});

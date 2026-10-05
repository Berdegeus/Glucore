import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortFigure, describeCohortWidget } from '../../../../test/professionalWidgetHarness';
import ProKpiHypo, { PRO_KPI_HYPO_TITLE, proKpiHypoDefinition } from './proKpiHypo';

describeCohortWidget({ Widget: ProKpiHypo, definition: proKpiHypoDefinition, title: PRO_KPI_HYPO_TITLE, shown: '1' });

describeCohortFigure({
  Widget: ProKpiHypo,
  title: PRO_KPI_HYPO_TITLE,
  withValue: (value) => cohortSummaryOf({ patientsWithHypo: value ?? 0 }),
  samples: [
    { value: 3, shown: '3' },
    { value: 0, shown: '0' },
  ],
  note: 'com hipoglicemia no período',
  requirement: 'PRO-09',
});

import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortFigure, describeCohortWidget } from '../../../../test/professionalWidgetHarness';
import ProKpiGmi, { PRO_KPI_GMI_TITLE, proKpiGmiDefinition } from './proKpiGmi';

describeCohortWidget({ Widget: ProKpiGmi, definition: proKpiGmiDefinition, title: PRO_KPI_GMI_TITLE, shown: '7,2' });

describeCohortFigure({
  Widget: ProKpiGmi,
  title: PRO_KPI_GMI_TITLE,
  withValue: (value) => cohortSummaryOf({ avgGmiPercent: value }),
  samples: [
    { value: 7.26, shown: '7,3' },
    { value: 6.9, shown: '6,9' },
    { value: null, shown: '—' },
  ],
  requirement: 'PRO-09',
});

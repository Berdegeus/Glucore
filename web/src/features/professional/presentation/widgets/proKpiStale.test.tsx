import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortFigure, describeCohortWidget } from '../../../../test/professionalWidgetHarness';
import ProKpiStale, { PRO_KPI_STALE_TITLE, proKpiStaleDefinition } from './proKpiStale';

describeCohortWidget({ Widget: ProKpiStale, definition: proKpiStaleDefinition, title: PRO_KPI_STALE_TITLE, shown: '1' });

describeCohortFigure({
  Widget: ProKpiStale,
  title: PRO_KPI_STALE_TITLE,
  withValue: (value) => cohortSummaryOf({ patientsStale: value ?? 0 }),
  samples: [
    { value: 4, shown: '4' },
    { value: 0, shown: '0' },
  ],
  note: 'sem leitura há mais de 24 h',
  requirement: 'PRO-09',
});

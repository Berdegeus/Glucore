import { describeTargetKpi, withField } from '../../../../test/targetKpiCases';
import { describeSummaryWidget } from '../../../../test/widgetHarness';
import KpiTir, { kpiTirDefinition, KPI_TIR_TITLE } from './kpiTir';

describeSummaryWidget({ Widget: KpiTir, definition: kpiTirDefinition, title: KPI_TIR_TITLE, shown: '23,5' });

describeTargetKpi({
  Widget: KpiTir,
  title: 'Tempo no alvo',
  withValue: withField('timeInRangePercent'),
  sample: { value: 82.34, shown: '82,3' },
  targetText: 'Meta: 70 %',
  boundaries: [
    { value: 69.9, met: false },
    { value: 70, met: true },
  ],
  requirement: 'PAC-05',
});

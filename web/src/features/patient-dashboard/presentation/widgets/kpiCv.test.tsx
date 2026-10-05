import { describeTargetKpi, withField } from '../../../../test/targetKpiCases';
import { describeSummaryWidget } from '../../../../test/widgetHarness';
import KpiCv, { kpiCvDefinition, KPI_CV_TITLE } from './kpiCv';

describeSummaryWidget({ Widget: KpiCv, definition: kpiCvDefinition, title: KPI_CV_TITLE, shown: '41,2' });

describeTargetKpi({
  Widget: KpiCv,
  title: 'Variabilidade (CV)',
  withValue: withField('coefficientOfVariationPercent'),
  sample: { value: 30.26, shown: '30,3' },
  targetText: 'Meta: até 36 %',
  boundaries: [
    { value: 36, met: true },
    { value: 36.1, met: false },
  ],
  requirement: 'PAC-05',
});

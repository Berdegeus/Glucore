import { describeTargetKpi, withField } from '../../../../test/targetKpiCases';
import { describeSummaryWidget } from '../../../../test/widgetHarness';
import KpiSensorUse, { kpiSensorUseDefinition, KPI_SENSOR_USE_TITLE } from './kpiSensorUse';

describeSummaryWidget({
  Widget: KpiSensorUse,
  definition: kpiSensorUseDefinition,
  title: KPI_SENSOR_USE_TITLE,
  shown: '3,0',
});

describeTargetKpi({
  Widget: KpiSensorUse,
  title: 'Uso do sensor',
  withValue: withField('sensorUsePercent'),
  sample: { value: 88.46, shown: '88,5' },
  targetText: 'Meta: 70 %',
  boundaries: [
    { value: 69.9, met: false },
    { value: 70, met: true },
    { value: 100, met: true },
  ],
  requirement: 'PAC-05, API-04',
});

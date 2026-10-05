import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TARGET_MET_TEXT, TARGET_MISSED_TEXT } from '../../../../shared/presentation/ui/kpiCard';
import { summaryFixture } from '../../../../test/summaryFakes';
import { describeSummaryWidget, renderWidget } from '../../../../test/widgetHarness';
import KpiSensorUse, { kpiSensorUseDefinition, KPI_SENSOR_USE_TITLE } from './kpiSensorUse';

describeSummaryWidget({
  Widget: KpiSensorUse,
  definition: kpiSensorUseDefinition,
  title: KPI_SENSOR_USE_TITLE,
  shown: '3,0',
});

describe('kpi-sensor-use figure (PAC-05, API-04)', () => {
  it('shows the sensor use in percent from summary.sensorUsePercent, with the 70 % goal', async () => {
    renderWidget(<KpiSensorUse size="S" />, { summary: summaryFixture({ sensorUsePercent: 88.46 }) });

    const card = within(await screen.findByRole('region', { name: 'Uso do sensor' }));
    expect(await card.findByText('88,5')).toBeInTheDocument();
    expect(card.getByText('%')).toBeInTheDocument();
    expect(card.getByText('Meta: 70 %')).toBeInTheDocument();
    expect(card.getByText(TARGET_MET_TEXT)).toBeInTheDocument();
  });

  it.each([
    { value: 69.9, verdict: TARGET_MISSED_TEXT },
    { value: 70, verdict: TARGET_MET_TEXT },
    { value: 100, verdict: TARGET_MET_TEXT },
  ])('says "$verdict" for $value %, the goal being at least 70 %', async ({ value, verdict }) => {
    renderWidget(<KpiSensorUse size="S" />, { summary: summaryFixture({ sensorUsePercent: value }) });

    expect(await screen.findByText(verdict)).toBeInTheDocument();
  });
});

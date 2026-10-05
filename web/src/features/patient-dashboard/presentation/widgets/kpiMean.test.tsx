import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dayBucket, summaryFixture } from '../../../../test/summaryFakes';
import { describeSummaryWidget, renderWidget } from '../../../../test/widgetHarness';
import KpiMean, { kpiMeanDefinition, KPI_MEAN_TITLE } from './kpiMean';

describeSummaryWidget({ Widget: KpiMean, definition: kpiMeanDefinition, title: KPI_MEAN_TITLE, shown: '151' });

describe('kpi-mean figure (PAC-05)', () => {
  it('shows the mean in whole mg/dL, weighting each day by its readings, with no target', async () => {
    // A plain mean of the two days would be 150; weighted by 100 and 300 readings it is 175.
    const byDay = [
      dayBucket({ day: '2026-08-05', avgGlucose: 100, readingsCount: 100 }),
      dayBucket({ day: '2026-08-06', avgGlucose: 200, readingsCount: 300 }),
    ];
    renderWidget(<KpiMean size="S" />, { summary: summaryFixture({ byDay }) });

    expect(await screen.findByText('175')).toBeInTheDocument();
    expect(screen.getByText('mg/dL')).toBeInTheDocument();
    expect(screen.queryByText(/Meta/)).not.toBeInTheDocument();
  });

  it('ignores a day with no readings', async () => {
    const byDay = [
      dayBucket({ day: '2026-08-05', avgGlucose: 130, readingsCount: 10 }),
      dayBucket({ day: '2026-08-06', avgGlucose: null, readingsCount: 0 }),
    ];
    renderWidget(<KpiMean size="S" />, { summary: summaryFixture({ byDay }) });

    expect(await screen.findByText('130')).toBeInTheDocument();
  });

  it('shows the cause when no day has a glucose average, though other figures of the summary exist', async () => {
    const byDay = [dayBucket({ avgGlucose: null, readingsCount: 0 })];
    renderWidget(<KpiMean size="S" />, { summary: summaryFixture({ byDay }) });

    expect(await screen.findByText('Sem leituras no período')).toBeInTheDocument();
  });
});

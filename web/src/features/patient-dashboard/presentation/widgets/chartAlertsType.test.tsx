import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { summaryFixture } from '../../../../test/summaryFakes';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartAlertsType, { chartAlertsTypeDefinition, CHART_ALERTS_TYPE_TITLE, NO_ALERTS_CAUSE } from './chartAlertsType';

const NBSP = '\u00a0';

// The fixture carries a type the app does not name, so it also shows the fallback.
describeChartWidget({
  Widget: ChartAlertsType,
  definition: chartAlertsTypeDefinition,
  title: CHART_ALERTS_TYPE_TITLE,
  emptyCause: NO_ALERTS_CAUSE,
  summary: `Alertas por tipo, 3${NBSP}alertas no período: HIGH 3.`,
  columns: ['Tipo', 'Alertas'],
  rows: [['HIGH', '3']],
});

describe('chart-alerts-type figure (PAC-09)', () => {
  const alertsByType = [
    { alertType: 'HYPO_RISK', count: 2 },
    { alertType: 'SYNC_FAILURE', count: 1 },
  ];

  it('draws one bar per alert type', async () => {
    const { container } = renderWidget(<ChartAlertsType size="M" />, { summary: summaryFixture({ alertsByType }) });

    await screen.findByRole('img');
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2);
  });

  it('labels the bars with readable names, not the enum values', async () => {
    const { container } = renderWidget(<ChartAlertsType size="M" />, { summary: summaryFixture({ alertsByType }) });

    await screen.findByRole('img');
    const labels = [...container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((label) => label.textContent);
    expect(labels).toEqual(['Risco de hipoglicemia', 'Falha de sincronização']);
  });

  it('says no alert fired, not that there are no readings, when only the alerts are missing', async () => {
    renderWidget(<ChartAlertsType size="M" />, { summary: summaryFixture({ alertsByType: [] }) });

    expect(await screen.findByText('Nenhum alerta no período')).toBeInTheDocument();
  });
});

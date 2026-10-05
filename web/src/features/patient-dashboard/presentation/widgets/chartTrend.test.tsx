import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartTrend, { chartTrendDefinition, CHART_TREND_TITLE } from './chartTrend';

const NBSP = '\u00a0';

describeChartWidget({
  Widget: ChartTrend,
  definition: chartTrendDefinition,
  title: CHART_TREND_TITLE,
  summary: 'Tendência da glicose por dia, de 05/08 a 06/08: média diária de 151 mg/dL, com faixa-alvo de 80 a 180 mg/dL.',
  columns: ['Dia', 'Média', 'Mínimo', 'Máximo', 'Média móvel de 7 dias'],
  rows: [
    ['05/08/2026', `151${NBSP}mg/dL`, `60${NBSP}mg/dL`, `250${NBSP}mg/dL`, `151${NBSP}mg/dL`],
    ['06/08/2026', '—', '—', '—', '—'],
  ],
});

describe('chart-trend figure (PAC-06)', () => {
  it('names the daily mean, the min-max band, the 7-day average and the target range in the legend', async () => {
    renderWidget(<ChartTrend size="L" />);

    const region = within(await screen.findByRole('region', { name: CHART_TREND_TITLE }));
    for (const label of ['Média diária', 'Média móvel de 7 dias', 'Mínimo a máximo', 'Faixa-alvo (80 a 180 mg/dL)']) {
      expect(await region.findByText(label)).toBeInTheDocument();
    }
  });
});

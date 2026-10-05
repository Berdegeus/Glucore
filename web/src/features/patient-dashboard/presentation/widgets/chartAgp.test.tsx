import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartAgp, { chartAgpDefinition, CHART_AGP_TITLE } from './chartAgp';

const NBSP = '\u00a0';
const mgdl = (value: number) => `${value}${NBSP}mg/dL`;

describeChartWidget({
  Widget: ChartAgp,
  definition: chartAgpDefinition,
  title: CHART_AGP_TITLE,
  summary: 'Perfil ambulatorial da glicose por hora: das 8h às 9h, mediana de 70 a 250 mg/dL, com as faixas dos percentis 25 a 75 e 5 a 95.',
  columns: ['Hora', 'P5', 'P25', 'Mediana', 'P75', 'P95', 'Leituras'],
  rows: [
    ['8h', mgdl(60), mgdl(63), mgdl(70), mgdl(80), mgdl(90), '8'],
    ['9h', mgdl(165), mgdl(225), mgdl(250), mgdl(250), mgdl(250), '4'],
  ],
});

describe('chart-agp figure (PAC-10)', () => {
  it('names the two percentile bands and the median in the legend', async () => {
    renderWidget(<ChartAgp size="L" />);

    const region = within(await screen.findByRole('region', { name: CHART_AGP_TITLE }));
    const legend = (await region.findAllByRole('listitem')).map((item) => item.textContent);
    expect(legend).toEqual(['Percentis 5 a 95', 'Percentis 25 a 75', 'Mediana']);
  });

  it('draws the median line over the hours that have readings', async () => {
    const { container } = renderWidget(<ChartAgp size="L" />);

    await screen.findByRole('img');
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(1);
  });
});

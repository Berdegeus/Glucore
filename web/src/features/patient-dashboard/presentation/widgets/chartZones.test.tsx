import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ZONE_COLORS } from '../../../../shared/presentation/charts/palette';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartZones, { chartZonesDefinition, CHART_ZONES_TITLE } from './chartZones';

const NBSP = ' ';

describeChartWidget({
  Widget: ChartZones,
  definition: chartZonesDefinition,
  title: CHART_ZONES_TITLE,
  summary: `Distribuição do tempo em cinco zonas de glicose: muito baixa 0,0${NBSP}%, baixa 29,4${NBSP}%, no alvo 23,5${NBSP}%, alta 47,1${NBSP}%, muito alta 0,0${NBSP}%.`,
  columns: ['Zona', 'Percentual'],
  rows: [
    ['Muito baixa', `0,0${NBSP}%`],
    ['Baixa', `29,4${NBSP}%`],
    ['No alvo', `23,5${NBSP}%`],
    ['Alta', `47,1${NBSP}%`],
    ['Muito alta', `0,0${NBSP}%`],
  ],
});

describe('chart-zones figure (PAC-10)', () => {
  it('names the five zones in order in the legend, one stacked bar in the zone hues', async () => {
    const { container } = renderWidget(<ChartZones size="M" />);

    const region = within(await screen.findByRole('region', { name: CHART_ZONES_TITLE }));
    const legend = (await region.findAllByRole('listitem')).map((item) => item.textContent);
    expect(legend).toEqual(['Muito baixa', 'Baixa', 'No alvo', 'Alta', 'Muito alta']);
    const fills = [...container.querySelectorAll('.recharts-bar-rectangle path')].map((bar) => bar.getAttribute('fill'));
    // The fixture has no very low or very high share, so only the three zones in between get a segment.
    expect(fills).toEqual([ZONE_COLORS[1], ZONE_COLORS[2], ZONE_COLORS[3]]);
  });
});

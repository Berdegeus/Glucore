import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartHeatmap, { chartHeatmapDefinition, CHART_HEATMAP_TITLE } from './chartHeatmap';

const NBSP = '\u00a0';

describeChartWidget({
  Widget: ChartHeatmap,
  definition: chartHeatmapDefinition,
  title: CHART_HEATMAP_TITLE,
  summary: 'Mapa de calor da glicose por dia da semana e hora: glicose média de 75 a 143 mg/dL; combinações de dia e hora com leituras: 2.',
  columns: ['Dia da semana', 'Hora', 'Glicose média', 'Leituras'],
  rows: [
    ['quarta-feira', '8h', `75${NBSP}mg/dL`, '6'],
    ['quinta-feira', '8h', `143${NBSP}mg/dL`, '2'],
  ],
});

describe('chart-heatmap figure (PAC-10)', () => {
  it('draws the 7 x 24 grid with a colored cell only where the weekday and hour have readings', async () => {
    const { container } = renderWidget(<ChartHeatmap size="L" />);

    await screen.findByRole('img');
    expect(container.querySelectorAll('rect[data-day]')).toHaveLength(168);
    const filled = [...container.querySelectorAll('rect[data-day]:not([data-empty])')];
    expect(filled.map((rect) => [rect.getAttribute('data-day'), rect.getAttribute('data-hour')])).toEqual([
      ['3', '8'],
      ['4', '8'],
    ]);
  });

  it('labels the weekdays in pt-BR, Sunday first, and titles a cell with day, hour and mean', async () => {
    const { container } = renderWidget(<ChartHeatmap size="L" />);

    await screen.findByRole('img');
    const labels = [...container.querySelectorAll('svg text')].map((text) => text.textContent).filter((text) => /^\D{3}$/.test(text ?? ''));
    expect(labels).toEqual(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']);
    expect(container.querySelector('rect[data-day="3"][data-hour="8"] title')?.textContent).toBe(`qua, 8h: 75${NBSP}mg/dL`);
  });
});

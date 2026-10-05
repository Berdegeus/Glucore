import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessibleInFrame } from '../../../test/chartA11y';
import { stubChartContainer } from '../../../test/chartContainer';
import { expectResponsive, renderChart } from '../../../test/chartQueries';
import { LineBandChart, withBand, type LineBandChartProps } from './lineBandChart';

stubChartContainer({ width: 600, height: 280 });

const DATA = [
  { day: '01/10', mean: 120, avg7: 118, min: 80, max: 190 },
  { day: '02/10', mean: 140, avg7: 125, min: 90, max: 210 },
  { day: '03/10', mean: 110, avg7: 124, min: 70, max: 170 },
];

const LINES = [
  { key: 'mean', label: 'Média diária' },
  { key: 'avg7', label: 'Média de 7 dias', dashed: true },
];

const BAND = { minKey: 'min', maxKey: 'max', label: 'Mínimo a máximo' };
const TARGET = { low: 70, high: 180, label: 'Faixa-alvo' };

const drawChart = (props: Partial<LineBandChartProps> = {}) =>
  renderChart(<LineBandChart data={DATA} xKey="day" lines={LINES} {...props} />);

describe('LineBandChart', () => {
  it('draws inside a ResponsiveContainer, at the container width (RSP-05)', () => {
    const { container } = drawChart();
    expectResponsive(container);
  });

  it('draws one curve per series, in series colors, dashing the one that asks for it (PAC-06)', () => {
    const { all } = drawChart();
    const curves = all('.recharts-line-curve');
    expect(curves.map((curve) => curve.getAttribute('stroke'))).toEqual(['var(--series-1)', 'var(--series-2)']);
    expect(curves.map((curve) => curve.getAttribute('stroke-dasharray'))).toEqual([null, '6 4']);
  });

  it('draws the min-max band as one filled area behind the lines (PAC-06)', () => {
    const { all } = drawChart({ band: BAND });
    expect(all('.recharts-area-area')).toHaveLength(1);
    expect(drawChart().all('.recharts-area')).toHaveLength(0);
  });

  it('draws the target range between the limits it received (PAC-06)', () => {
    const { all } = drawChart({ targetRange: TARGET });
    const [area] = all('.recharts-reference-area-rect');
    expect(area).toHaveAttribute('y1', '70');
    expect(area).toHaveAttribute('y2', '180');
  });

  it('draws a marker on every point with the shape of its series, only when asked (RSP-08)', () => {
    const plain = drawChart().all('.recharts-line-dots .recharts-symbols');
    expect(plain).toHaveLength(0);

    const { all } = drawChart({ markers: true });
    const symbols = all('.recharts-line-dots .recharts-symbols');
    expect(symbols).toHaveLength(DATA.length * LINES.length);
    const shapes = new Set(symbols.map((symbol) => symbol.getAttribute('d')));
    expect(shapes.size).toBe(LINES.length);
  });

  it('fills under each line when asked', () => {
    const { all } = drawChart({ filled: true });
    expect(all('.recharts-area-area')).toHaveLength(LINES.length);
    expect(all('.recharts-line-curve')).toHaveLength(0);
  });

  it('lists every series, the band and the target range in the legend', () => {
    drawChart({ band: BAND, targetRange: TARGET });
    const labels = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(labels).toEqual(['Média diária', 'Média de 7 dias', 'Mínimo a máximo', 'Faixa-alvo']);
  });

  it('has no axe violations inside the chart frame (PAC-06)', async () => {
    await expectAccessibleInFrame(<LineBandChart data={DATA} xKey="day" lines={LINES} band={BAND} targetRange={TARGET} markers />);
  });
});

describe('withBand', () => {
  it('pairs the min and max of each row for the Recharts range area', () => {
    expect(withBand(DATA, BAND).map((row) => row.__band)).toEqual([
      [80, 190],
      [90, 210],
      [70, 170],
    ]);
  });

  it('leaves a gap where either end is missing, and the data alone without a band', () => {
    const rows = [
      { day: 'a', min: null, max: 10 },
      { day: 'b', min: 5, max: null },
    ];
    expect(withBand(rows, BAND).map((row) => row.__band)).toEqual([null, null]);
    expect(withBand(rows, undefined)).toEqual(rows);
  });
});

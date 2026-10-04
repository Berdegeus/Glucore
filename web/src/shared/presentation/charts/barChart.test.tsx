import { describe, expect, it } from 'vitest';
import { stubChartContainer } from '../../../test/chartContainer';
import { renderChart } from '../../../test/chartQueries';
import { BarChart, type BarChartProps } from './barChart';

stubChartContainer({ width: 600, height: 280 });

const DATA = [
  { day: 'seg', tir: 20, other: 10 },
  { day: 'ter', tir: 40, other: 30 },
  { day: 'qua', tir: 80, other: 50 },
];

const ONE = [{ key: 'tir', label: 'Tempo no alvo' }];
const TWO = [...ONE, { key: 'other', label: 'Outro' }];

const draw = (props: Partial<BarChartProps> = {}) =>
  renderChart(<BarChart data={DATA} categoryKey="day" series={ONE} domain={[0, 100]} {...props} />);

const heightOf = (bar: Element) => Number(bar.getAttribute('height'));

describe('BarChart', () => {
  it('draws inside a ResponsiveContainer, at the container width (RSP-05)', () => {
    const { container } = draw();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('width', '600');
  });

  it('draws one bar per category for a single series, sized by value (PAC-07)', () => {
    const bars = draw().all('.recharts-bar-rectangle path');
    expect(bars).toHaveLength(DATA.length);
    const [low, middle, high] = bars.map(heightOf) as [number, number, number];
    expect(middle).toBeCloseTo(low * 2, 0);
    expect(high).toBeCloseTo(low * 4, 0);
    expect(bars.map((bar) => bar.getAttribute('fill'))).toEqual(Array(3).fill('var(--series-1)'));
  });

  it('draws grouped bars for two series, each in its own color, with a legend (PAC-09)', () => {
    const { all } = draw({ series: TWO });
    const bars = all('.recharts-bar-rectangle path');
    expect(bars).toHaveLength(DATA.length * TWO.length);
    expect(new Set(bars.map((bar) => bar.getAttribute('fill')))).toEqual(new Set(['var(--series-1)', 'var(--series-2)']));
    expect(all('li').map((item) => item.textContent)).toEqual(['Tempo no alvo', 'Outro']);
  });

  it('labels the category axis with the categories received', () => {
    const labels = draw().all('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value');
    expect(labels.map((label) => label.textContent)).toEqual(['seg', 'ter', 'qua']);
  });

  it('formats the value axis with the formatter received', () => {
    const labels = draw({ formatValue: (value) => `${value} %` }).all('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value');
    expect(labels.map((label) => label.textContent)).toContain('100 %');
  });

  it('leaves no bar where a category has no value', () => {
    const gap = [DATA[0], { day: 'ter', tir: null, other: null }, DATA[2]] as BarChartProps['data'];
    expect(draw({ data: gap }).all('.recharts-bar-rectangle path')).toHaveLength(2);
  });
});

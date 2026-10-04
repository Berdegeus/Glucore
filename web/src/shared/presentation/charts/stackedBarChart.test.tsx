import { describe, expect, it } from 'vitest';
import { stubChartContainer } from '../../../test/chartContainer';
import { renderChart } from '../../../test/chartQueries';
import { ZONE_COLORS } from './palette';
import { StackedBarChart, type StackedBarChartProps } from './stackedBarChart';

stubChartContainer({ width: 600, height: 280 });

const ZONES = ['Muito baixo', 'Baixo', 'No alvo', 'Alto', 'Muito alto'];
const SEGMENTS = ZONES.map((label, index) => ({ key: `z${index}`, label, color: ZONE_COLORS[index] }));
const DATA = [{ patient: 'Ana', z0: 5, z1: 5, z2: 50, z3: 20, z4: 20 }];

const draw = (props: Partial<StackedBarChartProps> = {}) =>
  renderChart(<StackedBarChart data={DATA} categoryKey="patient" segments={SEGMENTS} domain={[0, 100]} {...props} />);

const num = (element: Element, attribute: string) => Number(element.getAttribute(attribute));
const segmentsOf = (all: (selector: string) => Element[]) => all('.recharts-bar-rectangle path');

describe('StackedBarChart', () => {
  it('draws inside a ResponsiveContainer, at the container width (RSP-05)', () => {
    const { container } = draw();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('width', '600');
  });

  it('stacks the segments from the base upward in the order of the zones, in zone colors (PAC-10)', () => {
    const bars = segmentsOf(draw().all);
    expect(bars.map((bar) => bar.getAttribute('fill'))).toEqual([...ZONE_COLORS]);
    const tops = bars.map((bar) => num(bar, 'y'));
    expect([...tops].sort((a, b) => b - a)).toEqual(tops);
    const heights = bars.map((bar) => num(bar, 'height'));
    expect(heights[2]).toBeCloseTo(heights[0]! * 10, 0);
  });

  it('lays horizontal bars out from the left in the same order, sized by value (PRO-10)', () => {
    const bars = segmentsOf(draw({ orientation: 'horizontal' }).all);
    const lefts = bars.map((bar) => num(bar, 'x'));
    expect([...lefts].sort((a, b) => a - b)).toEqual(lefts);
    const widths = bars.map((bar) => num(bar, 'width'));
    expect(widths[2]).toBeCloseTo(widths[0]! * 10, 0);
    expect(bars.map((bar) => num(bar, 'height')).every((h) => h === num(bars[0] as Element, 'height'))).toBe(true);
  });

  it.each([
    ['vertical', '.recharts-xAxis-tick-labels text'],
    ['horizontal', '.recharts-yAxis-tick-labels text'],
  ] as const)('puts the categories on the category axis of %s bars', (orientation, selector) => {
    const labels = draw({ orientation }).all(selector).map((label) => label.textContent);
    expect(labels).toEqual(['Ana']);
  });

  it('lists the segments in the legend in zone order, falling back to the series palette without a color', () => {
    const { all } = draw({ segments: SEGMENTS.map(({ key, label }) => ({ key, label })) });
    expect(all('li').map((item) => item.textContent)).toEqual(ZONES);
    expect(segmentsOf(all).map((bar) => bar.getAttribute('fill'))[0]).toBe('var(--series-1)');
  });
});

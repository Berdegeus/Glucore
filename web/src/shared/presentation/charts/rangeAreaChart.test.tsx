import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { stubChartContainer } from '../../../test/chartContainer';
import { expectResponsive, renderChart } from '../../../test/chartQueries';
import { ChartFrame } from './chartFrame';
import { RangeAreaChart, type RangeAreaChartProps } from './rangeAreaChart';

stubChartContainer({ width: 600, height: 280 });

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  hour: String(hour),
  p5: 70 + hour,
  p25: 100 + hour,
  median: 130 + hour,
  p75: 160 + hour,
  p95: 200 + hour,
}));

const PROPS: RangeAreaChartProps = {
  data: HOURS,
  xKey: 'hour',
  outer: { minKey: 'p5', maxKey: 'p95', label: 'P5 a P95' },
  inner: { minKey: 'p25', maxKey: 'p75', label: 'P25 a P75' },
  median: { key: 'median', label: 'Mediana' },
};

const draw = (props: Partial<RangeAreaChartProps> = {}) => renderChart(<RangeAreaChart {...PROPS} {...props} />);

/** The `y` of every `x,y` pair of a straight-segment SVG path. */
function ysOf(path: Element | undefined): number[] {
  const matches = (path?.getAttribute('d') ?? '').matchAll(/(-?[\d.]+),(-?[\d.]+)/g);
  return [...matches].map((match) => Number(match[2]));
}

describe('RangeAreaChart', () => {
  it('draws inside a ResponsiveContainer, at the container width (RSP-05)', () => {
    expectResponsive(draw().container);
  });

  it('draws the two bands and the median with one point per hour (PAC-10)', () => {
    const { all } = draw();
    const [outer, inner] = all('.recharts-area-area');
    expect(all('.recharts-area-area')).toHaveLength(2);
    // A band is its upper edge out and its lower edge back.
    expect(ysOf(outer)).toHaveLength(48);
    expect(ysOf(inner)).toHaveLength(48);
    expect(ysOf(all('.recharts-line-curve')[0])).toHaveLength(24);
  });

  it('nests the bands around the median at every hour (PAC-10)', () => {
    const { all } = draw();
    const [outer, inner] = all('.recharts-area-area').map(ysOf) as [number[], number[]];
    const median = ysOf(all('.recharts-line-curve')[0]);
    HOURS.forEach((_, hour) => {
      // SVG y grows downward: a larger glucose is a smaller y, so the order top to bottom is P95, P75, median, P25, P5.
      const topToBottom = [outer[hour], inner[hour], median[hour], inner[47 - hour], outer[47 - hour]] as number[];
      expect(topToBottom).toEqual([...topToBottom].sort((a, b) => a - b));
      expect(new Set(topToBottom).size).toBe(5);
    });
  });

  it('names both bands and the median in the legend', () => {
    expect(draw().all('li').map((item) => item.textContent)).toEqual(['P5 a P95', 'P25 a P75', 'Mediana']);
  });

  it('has no axe violations inside the chart frame (PAC-10)', async () => {
    const { container } = render(
      <ChartFrame title="AGP" summary="Perfil ambulatorial." columns={['Hora', 'Mediana']} rows={[['0', '130']]}>
        <RangeAreaChart {...PROPS} />
      </ChartFrame>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

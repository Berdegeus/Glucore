import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { stubChartContainer } from '../../../test/chartContainer';
import { renderChart } from '../../../test/chartQueries';
import { BarChart } from './barChart';
import { DonutChart } from './donutChart';
import { HeatmapChart } from './heatmapChart';
import { LineBandChart } from './lineBandChart';
import { RangeAreaChart } from './rangeAreaChart';
import { ScatterQuadrantChart } from './scatterQuadrantChart';
import { StackedBarChart } from './stackedBarChart';

const container = stubChartContainer({ width: 600, height: 280 });

const DAYS = [
  { day: 'seg', a: 40, b: 20, lo: 10, hi: 60 },
  { day: 'ter', a: 50, b: 30, lo: 20, hi: 70 },
  { day: 'qua', a: 60, b: 10, lo: 30, hi: 80 },
];
const SERIES = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
];

interface Adapter {
  name: string;
  chart: ReactElement;
  /** An element whose position depends on the chart width, and the attribute that holds it. */
  moving: [selector: string, attribute: string];
  /** The width of the drawing for a container `width` wide. */
  drawnWidth: (width: number) => number;
}

/** Recharts fills the container; the heatmap draws whole cells, 36 px of labels plus 24 columns. */
const fillsContainer = (width: number) => width;
const heatmapWidth = (width: number) => 36 + 24 * Math.max(10, Math.floor((width - 36) / 24));

const ADAPTERS: Adapter[] = [
  {
    name: 'LineBandChart',
    chart: <LineBandChart data={DAYS} xKey="day" lines={SERIES} band={{ minKey: 'lo', maxKey: 'hi', label: 'Faixa' }} />,
    moving: ['.recharts-line-curve', 'd'],
    drawnWidth: fillsContainer,
  },
  {
    name: 'BarChart',
    chart: <BarChart data={DAYS} categoryKey="day" series={SERIES} />,
    moving: ['.recharts-bar-rectangle path', 'x'],
    drawnWidth: fillsContainer,
  },
  {
    name: 'StackedBarChart',
    chart: <StackedBarChart data={DAYS} categoryKey="day" segments={SERIES} />,
    moving: ['.recharts-bar-rectangle path', 'x'],
    drawnWidth: fillsContainer,
  },
  {
    name: 'DonutChart',
    chart: <DonutChart slices={[{ label: 'A', value: 3 }, { label: 'B', value: 1 }]} />,
    moving: ['.recharts-sector', 'd'],
    drawnWidth: fillsContainer,
  },
  {
    name: 'RangeAreaChart',
    chart: (
      <RangeAreaChart
        data={DAYS}
        xKey="day"
        outer={{ minKey: 'lo', maxKey: 'hi', label: 'Externa' }}
        inner={{ minKey: 'b', maxKey: 'a', label: 'Interna' }}
        median={{ key: 'a', label: 'Mediana' }}
      />
    ),
    moving: ['.recharts-area-area', 'd'],
    drawnWidth: fillsContainer,
  },
  {
    name: 'ScatterQuadrantChart',
    chart: (
      <ScatterQuadrantChart
        points={[{ label: 'Ana', x: 50, y: 20 }]}
        x={{ label: 'TIR', threshold: 70, domain: [0, 100] }}
        y={{ label: 'CV', threshold: 36, domain: [0, 60] }}
      />
    ),
    moving: ['.recharts-scatter-symbol path', 'cx'],
    drawnWidth: fillsContainer,
  },
  {
    name: 'HeatmapChart',
    chart: <HeatmapChart cells={[{ day: 1, hour: 23, value: 120 }]} />,
    moving: ['rect[data-hour="23"]', 'x'],
    drawnWidth: heatmapWidth,
  },
];

const WIDTHS = [600, 320, 900] as const;

describe('charts redraw when the container changes width (RSP-05)', () => {
  it.each(ADAPTERS)('$name draws at the width it is given and again at each new width', ({ chart, moving, drawnWidth }) => {
    const { all } = renderChart(chart);
    const read = () => ({
      width: Number(all('svg').find((svg) => svg.hasAttribute('width') && !svg.closest('li'))?.getAttribute('width')),
      position: all(moving[0])[0]?.getAttribute(moving[1]),
    });

    const seen = WIDTHS.map((width, step) => {
      if (step > 0) container.resize({ width });
      return read();
    });

    expect(seen.map((state) => state.width)).toEqual(WIDTHS.map(drawnWidth));
    // Each width moves the drawing: no two widths leave the same position.
    expect(new Set(seen.map((state) => state.position)).size).toBe(WIDTHS.length);
  });
});

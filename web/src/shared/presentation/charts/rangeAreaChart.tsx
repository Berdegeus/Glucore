import type { ReactElement } from 'react';
import { Area, ComposedChart, Line } from 'recharts';
import { ChartAxes } from './chartAxes';
import { withRanges } from './chartBands';
import { BASE_CHART_PROPS, NO_ANIMATION, defaultFormat } from './chartDefaults';
import { ChartGrid, ChartSurface, ChartTooltip } from './chartSurface';
import type { ChartRow, SeriesSpec, ValueFormatter } from './chartTypes';
import { seriesColor } from './palette';

export interface PercentileBand {
  minKey: string;
  maxKey: string;
  label: string;
}

export interface RangeAreaChartProps {
  data: readonly ChartRow[];
  /** Key of the category axis; the hour of the day for an AGP. */
  xKey: string;
  /** The wide band, e.g. P5 to P95. */
  outer: PercentileBand;
  /** The narrow band inside it, e.g. P25 to P75. */
  inner: PercentileBand;
  /** The line through both, e.g. the median. */
  median: SeriesSpec;
  height?: number;
  formatX?: (value: string) => string;
  formatY?: ValueFormatter;
}

export const OUTER_DATA_KEY = '__outer';
export const INNER_DATA_KEY = '__inner';

const COLOR = seriesColor(0);

/** Two nested percentile bands and the median per hour: the ambulatory glucose profile (PAC-10). */
export function RangeAreaChart({
  data,
  xKey,
  outer,
  inner,
  median,
  height,
  formatX,
  formatY = defaultFormat,
}: RangeAreaChartProps): ReactElement {
  const rows = withRanges(data, [
    { dataKey: OUTER_DATA_KEY, minKey: outer.minKey, maxKey: outer.maxKey },
    { dataKey: INNER_DATA_KEY, minKey: inner.minKey, maxKey: inner.maxKey },
  ]);
  const legend = [
    { label: outer.label, color: COLOR, opacity: 0.2 },
    { label: inner.label, color: COLOR, opacity: 0.45 },
    { label: median.label, color: COLOR },
  ];
  // Straight segments: one reading per hour, nothing to interpolate between.
  const band = { type: 'linear', stroke: 'none', fill: COLOR, dot: false, activeDot: false, ...NO_ANIMATION } as const;
  return (
    <ChartSurface height={height} legend={legend}>
      <ComposedChart data={rows} {...BASE_CHART_PROPS}>
        <ChartGrid />
        <ChartAxes categoryKey={xKey} formatCategory={formatX} formatValue={formatY} />
        <Area dataKey={OUTER_DATA_KEY} name={outer.label} fillOpacity={0.2} {...band} />
        <Area dataKey={INNER_DATA_KEY} name={inner.label} fillOpacity={0.45} {...band} />
        <Line dataKey={median.key} name={median.label} type="linear" stroke={COLOR} strokeWidth={2} dot={false} {...NO_ANIMATION} />
        <ChartTooltip format={formatY} />
      </ComposedChart>
    </ChartSurface>
  );
}

import type { ReactElement } from 'react';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AXIS_TICK,
  BASE_CHART_PROPS,
  GRID_PROPS,
  NO_ANIMATION,
  TOOLTIP_STYLE,
  defaultFormat,
  tooltipValue,
} from './chartDefaults';
import { ChartSurface } from './chartSurface';
import type { ChartRow, SeriesSpec, ValueFormatter } from './chartTypes';
import { seriesColor } from './palette';

const STACK_ID = 'stack';

export interface SegmentSpec extends SeriesSpec {
  /** A CSS color; the series palette when absent. Zones pass `ZONE_COLORS`. */
  color?: string;
}

export interface StackedBarChartProps {
  data: readonly ChartRow[];
  categoryKey: string;
  /** From the base of the bar (bottom, or left) to its end. */
  segments: readonly SegmentSpec[];
  /** Direction of the bars; vertical by default. */
  orientation?: 'vertical' | 'horizontal';
  domain?: readonly [number, number];
  height?: number;
  formatCategory?: (value: string) => string;
  formatValue?: ValueFormatter;
}

const colorOf = (segment: SegmentSpec, index: number) => segment.color ?? seriesColor(index);

/** Vertical or horizontal stacked bars, one segment per zone or type (PAC-10, PRO-10). */
export function StackedBarChart({
  data,
  categoryKey,
  segments,
  orientation = 'vertical',
  domain,
  height,
  formatCategory,
  formatValue = defaultFormat,
}: StackedBarChartProps): ReactElement {
  const horizontal = orientation === 'horizontal';
  const legend = segments.map((segment, index) => ({ label: segment.label, color: colorOf(segment, index) }));
  const category = { dataKey: categoryKey, tick: AXIS_TICK, tickFormatter: formatCategory };
  const value = { tick: AXIS_TICK, tickFormatter: formatValue, domain: domain ? [...domain] : undefined };
  return (
    <ChartSurface height={height} legend={legend}>
      <RechartsBarChart data={[...data]} layout={horizontal ? 'vertical' : 'horizontal'} {...BASE_CHART_PROPS}>
        <CartesianGrid {...GRID_PROPS} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...value} />
            <YAxis type="category" width={72} {...category} />
          </>
        ) : (
          <>
            <XAxis type="category" {...category} />
            <YAxis type="number" width={48} {...value} />
          </>
        )}
        {segments.map((segment, index) => (
          <Bar
            key={segment.key}
            dataKey={segment.key}
            name={segment.label}
            stackId={STACK_ID}
            fill={colorOf(segment, index)}
            stroke="var(--color-canvas)"
            {...NO_ANIMATION}
          />
        ))}
        <Tooltip formatter={tooltipValue(formatValue)} cursor={{ fill: 'var(--color-surface-sunken)' }} {...TOOLTIP_STYLE} />
      </RechartsBarChart>
    </ChartSurface>
  );
}

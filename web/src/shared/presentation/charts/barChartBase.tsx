import type { ReactElement } from 'react';
import { Bar, BarChart as RechartsBarChart } from 'recharts';
import { ChartAxes } from './chartAxes';
import { BASE_CHART_PROPS, NO_ANIMATION, defaultFormat } from './chartDefaults';
import { ChartGrid, ChartSurface, ChartTooltip } from './chartSurface';
import type { ChartRow, SeriesSpec, ValueFormatter } from './chartTypes';
import { seriesColor } from './palette';

const STACK_ID = 'stack';

export interface BarSeriesSpec extends SeriesSpec {
  /** A CSS color; the series palette when absent. Zones pass `ZONE_COLORS`. */
  color?: string;
}

export interface BarChartBaseProps {
  data: readonly ChartRow[];
  categoryKey: string;
  series: readonly BarSeriesSpec[];
  /** Stack the series in one bar, from the base outward, instead of grouping them. */
  stacked?: boolean;
  /** Bars grow from the left instead of from the bottom. */
  horizontal?: boolean;
  /** Show the legend even for a single series. */
  alwaysLegend?: boolean;
  domain?: readonly [number, number];
  height?: number;
  formatCategory?: (value: string) => string;
  formatValue?: ValueFormatter;
}

const colorOf = (spec: BarSeriesSpec, index: number) => spec.color ?? seriesColor(index);

/** What the bar adapters share; they differ in how they name and default these props. */
export function BarChartBase({
  data,
  categoryKey,
  series,
  stacked = false,
  horizontal = false,
  alwaysLegend = false,
  domain,
  height,
  formatCategory,
  formatValue = defaultFormat,
}: BarChartBaseProps): ReactElement {
  const showLegend = alwaysLegend || series.length > 1;
  const legend = showLegend ? series.map((spec, index) => ({ label: spec.label, color: colorOf(spec, index) })) : [];
  return (
    <ChartSurface height={height} legend={legend}>
      <RechartsBarChart data={[...data]} layout={horizontal ? 'vertical' : 'horizontal'} {...BASE_CHART_PROPS}>
        <ChartGrid vertical={horizontal} />
        <ChartAxes
          categoryKey={categoryKey}
          horizontal={horizontal}
          domain={domain}
          formatCategory={formatCategory}
          formatValue={formatValue}
        />
        {series.map((spec, index) => (
          <Bar
            key={spec.key}
            dataKey={spec.key}
            name={spec.label}
            stackId={stacked ? STACK_ID : undefined}
            fill={colorOf(spec, index)}
            stroke={stacked ? 'var(--color-canvas)' : undefined}
            {...NO_ANIMATION}
          />
        ))}
        <ChartTooltip format={formatValue} cursor />
      </RechartsBarChart>
    </ChartSurface>
  );
}

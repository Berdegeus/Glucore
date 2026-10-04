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

export interface BarChartProps {
  data: readonly ChartRow[];
  /** Key of the category axis (a day, a type). */
  categoryKey: string;
  /** One series gives simple bars; two or more give grouped bars. */
  series: readonly SeriesSpec[];
  /** Fixed value-axis domain, e.g. `[0, 100]` for a percentage. */
  domain?: readonly [number, number];
  height?: number;
  formatCategory?: (value: string) => string;
  formatValue?: ValueFormatter;
}

/** Simple or grouped vertical bars (PAC-07, PAC-09). */
export function BarChart({
  data,
  categoryKey,
  series,
  domain,
  height,
  formatCategory,
  formatValue = defaultFormat,
}: BarChartProps): ReactElement {
  const legend = series.length > 1 ? series.map((item, index) => ({ label: item.label, color: seriesColor(index) })) : [];
  return (
    <ChartSurface height={height} legend={legend}>
      <RechartsBarChart data={[...data]} {...BASE_CHART_PROPS}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={categoryKey} tick={AXIS_TICK} tickFormatter={formatCategory} />
        <YAxis tick={AXIS_TICK} tickFormatter={formatValue} width={48} domain={domain ? [...domain] : undefined} />
        {series.map((item, index) => (
          <Bar key={item.key} dataKey={item.key} name={item.label} fill={seriesColor(index)} {...NO_ANIMATION} />
        ))}
        <Tooltip formatter={tooltipValue(formatValue)} cursor={{ fill: 'var(--color-surface-sunken)' }} {...TOOLTIP_STYLE} />
      </RechartsBarChart>
    </ChartSurface>
  );
}

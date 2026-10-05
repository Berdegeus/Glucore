import type { ReactElement } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import { EmptyState } from '../ui/states';
import { formatPercent } from '../format';
import { CHART_COLORS, seriesColor } from './palette';
import { BASE_CHART_PROPS, NO_ANIMATION, defaultFormat } from './chartDefaults';
import { ChartSurface, ChartTooltip } from './chartSurface';
import type { ValueFormatter } from './chartTypes';

export const DONUT_EMPTY_CAUSE = 'Não há dados para este gráfico.';

export interface DonutSlice {
  label: string;
  value: number;
  /** A CSS color; the series palette when absent. */
  color?: string;
}

export interface DonutChartProps {
  slices: readonly DonutSlice[];
  height?: number;
  /** Why there is nothing to show when every value is zero. */
  emptyCause?: string;
  formatValue?: ValueFormatter;
}

const LABEL_GAP = 14;
const RADIAN = Math.PI / 180;

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  index?: number;
}

/** A percentage just outside its slice. */
function PercentLabel({ cx = 0, cy = 0, midAngle = 0, outerRadius = 0, percent = 0, index }: PieLabelProps) {
  const radius = outerRadius + LABEL_GAP;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      key={index}
      x={x}
      y={y}
      fill={CHART_COLORS.text}
      fontSize={12}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      {formatPercent(percent * 100)}
    </text>
  );
}

/** A donut with a percentage label per slice; all-zero data shows the empty state (ADM-02). */
export function DonutChart({
  slices,
  height,
  emptyCause = DONUT_EMPTY_CAUSE,
  formatValue = defaultFormat,
}: DonutChartProps): ReactElement {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return <EmptyState cause={emptyCause} />;
  const colors = slices.map((slice, index) => slice.color ?? seriesColor(index));
  const legend = slices.map((slice, index) => ({ label: slice.label, color: colors[index] as string }));
  return (
    <ChartSurface height={height} legend={legend}>
      <PieChart {...BASE_CHART_PROPS}>
        <Pie
          data={slices.map((slice) => ({ name: slice.label, value: slice.value }))}
          dataKey="value"
          nameKey="name"
          innerRadius="50%"
          outerRadius="75%"
          paddingAngle={slices.length > 1 ? 1 : 0}
          stroke="var(--color-canvas)"
          label={PercentLabel}
          labelLine={false}
          rootTabIndex={-1}
          {...NO_ANIMATION}
        >
          {colors.map((color, index) => (
            <Cell key={slices[index]?.label} fill={color} />
          ))}
        </Pie>
        <ChartTooltip format={formatValue} />
      </PieChart>
    </ChartSurface>
  );
}

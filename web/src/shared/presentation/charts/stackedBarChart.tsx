import type { ReactElement } from 'react';
import { BarChartBase, type BarChartBaseProps, type BarSeriesSpec } from './barChartBase';

export type SegmentSpec = BarSeriesSpec;

export interface StackedBarChartProps extends Omit<BarChartBaseProps, 'series' | 'stacked' | 'horizontal' | 'alwaysLegend'> {
  /** From the base of the bar (bottom, or left) to its end. */
  segments: readonly SegmentSpec[];
  /** Direction of the bars; vertical by default. */
  orientation?: 'vertical' | 'horizontal';
}

/** Vertical or horizontal stacked bars, one segment per zone or type (PAC-10, PRO-10). */
export function StackedBarChart({ segments, orientation = 'vertical', ...rest }: StackedBarChartProps): ReactElement {
  return <BarChartBase {...rest} series={segments} stacked horizontal={orientation === 'horizontal'} alwaysLegend />;
}

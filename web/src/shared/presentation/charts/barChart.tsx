import type { ReactElement } from 'react';
import { BarChartBase, type BarChartBaseProps } from './barChartBase';

export type BarChartProps = Omit<BarChartBaseProps, 'stacked' | 'horizontal' | 'alwaysLegend'>;

/** Simple (one series) or grouped (several) vertical bars (PAC-07, PAC-09). */
export function BarChart(props: BarChartProps): ReactElement {
  return <BarChartBase {...props} />;
}

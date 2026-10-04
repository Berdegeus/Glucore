import type { ReactNode } from 'react';
import { formatNumber } from '../format';
import { CHART_COLORS } from './palette';
import type { ValueFormatter } from './chartTypes';

export const DEFAULT_CHART_HEIGHT = 280;

export const CHART_MARGIN = { top: 8, right: 12, bottom: 4, left: 0 } as const;

/**
 * Props every Cartesian chart gets. Animation is off (nothing moves for people
 * who asked for less motion). The accessibility layer is off because the chart
 * sits inside `ChartFrame`'s `role="img"`, where a focusable child is a violation;
 * the keyboard and screen reader alternative is the table view (RSP-07).
 */
export const BASE_CHART_PROPS = { margin: CHART_MARGIN, accessibilityLayer: false } as const;

export const NO_ANIMATION = { isAnimationActive: false } as const;

export const AXIS_TICK = { fill: CHART_COLORS.axis, fontSize: 12 } as const;

export const GRID_PROPS = { stroke: CHART_COLORS.grid, strokeOpacity: 0.35, vertical: false } as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-canvas)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-1)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-1)',
  },
  labelStyle: { color: 'var(--color-text)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-text)' },
} as const;

/** Whole numbers with a decimal comma (pt-BR) unless the caller says otherwise. */
export const defaultFormat: ValueFormatter = (value) => formatNumber(value, 0);

/** A tooltip value: one number, or the `[min, max]` pair of a band. */
export function tooltipValue(format: ValueFormatter) {
  return (value: unknown): ReactNode => {
    if (Array.isArray(value)) return value.map((part) => format(Number(part))).join(' – ');
    return typeof value === 'number' ? format(value) : String(value ?? '');
  };
}

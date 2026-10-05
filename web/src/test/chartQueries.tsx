import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { expect } from 'vitest';

/** Renders a chart adapter and gives a `querySelectorAll` that returns an array. */
export function renderChart(chart: ReactElement) {
  const { container } = render(chart);
  const all = (selector: string): Element[] => [...container.querySelectorAll(selector)];
  return { container, all };
}

/** The chart sits in a `ResponsiveContainer` and its SVG has the container's width (RSP-05). */
export function expectResponsive(container: HTMLElement, width = 600): void {
  expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
  expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('width', String(width));
}

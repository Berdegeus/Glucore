import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/** Renders a chart adapter and gives a `querySelectorAll` that returns an array. */
export function renderChart(chart: ReactElement) {
  const { container } = render(chart);
  const all = (selector: string): Element[] => [...container.querySelectorAll(selector)];
  return { container, all };
}

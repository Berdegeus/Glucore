import { XAxis, YAxis } from 'recharts';
import { AXIS_TICK, defaultFormat } from './chartDefaults';
import type { ValueFormatter } from './chartTypes';

interface ChartAxesProps {
  /** Key of the category axis (a day, an hour, a zone). */
  categoryKey: string;
  /** Categories down the side and values along the bottom, for horizontal bars. */
  horizontal?: boolean;
  /** Fixed value-axis domain, e.g. `[0, 100]` for a percentage. */
  domain?: readonly [number, number];
  formatCategory?: (value: string) => string;
  formatValue?: ValueFormatter;
}

const CATEGORY_WIDTH = 72;
const VALUE_WIDTH = 48;

/** The category axis and the value axis of a Cartesian chart, in one place so every adapter labels alike. */
export function ChartAxes({ categoryKey, horizontal = false, domain, formatCategory, formatValue = defaultFormat }: ChartAxesProps) {
  const category = { dataKey: categoryKey, tick: AXIS_TICK, tickFormatter: formatCategory };
  const value = { tick: AXIS_TICK, tickFormatter: formatValue, domain: domain ? [...domain] : undefined };
  return horizontal ? (
    <>
      <XAxis type="number" {...value} />
      <YAxis type="category" width={CATEGORY_WIDTH} {...category} />
    </>
  ) : (
    <>
      <XAxis type="category" {...category} />
      <YAxis type="number" width={VALUE_WIDTH} {...value} />
    </>
  );
}

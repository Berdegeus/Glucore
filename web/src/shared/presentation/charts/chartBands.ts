import type { ChartRow } from './chartTypes';

export interface RangeSpec {
  /** Key the `[min, max]` pair is stored under; the Area reads it as its `dataKey`. */
  dataKey: string;
  minKey: string;
  maxKey: string;
}

/**
 * Adds the `[min, max]` pair Recharts reads for a range area. A missing end is
 * a gap in the band, not a zero.
 */
export function withRanges(data: readonly ChartRow[], ranges: readonly RangeSpec[]): ChartRow[] {
  return data.map((row) => {
    const pairs = ranges.map(({ dataKey, minKey, maxKey }) => {
      const { [minKey]: min, [maxKey]: max } = row;
      return [dataKey, typeof min === 'number' && typeof max === 'number' ? [min, max] : null] as const;
    });
    return { ...row, ...Object.fromEntries(pairs) } as unknown as ChartRow;
  });
}

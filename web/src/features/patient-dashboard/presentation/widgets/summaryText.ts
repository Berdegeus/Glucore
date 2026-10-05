import { formatNumber } from '../../../../shared/presentation/format';
import { shortDay } from './dayLabel';

/** `, de 05/08 a 06/08` for the days a chart covers; nothing when there is none. */
export function daySpan(days: ReadonlyArray<{ day: string }>): string {
  const first = days[0];
  const last = days[days.length - 1];
  return first && last ? `, de ${shortDay(first.day)} a ${shortDay(last.day)}` : '';
}

/** `100` when every value reads alike, `100 a 160` otherwise; `null` with no value to read. */
export function valueSpan(values: readonly number[], format: (value: number) => string): string | null {
  if (values.length === 0) return null;
  const low = format(Math.min(...values));
  const high = format(Math.max(...values));
  return low === high ? low : `${low} a ${high}`;
}

const NBSP = '\u00a0';

/** `1 registro`, `3 registros`: the noun agrees with the count. */
export function countOf(count: number, singular: string, plural: string): string {
  return `${count}${NBSP}${count === 1 ? singular : plural}`;
}

/** Insulin in units with one decimal: `30,5 U`. */
export const formatUnits = (units: number): string => `${formatNumber(units, 1)}${NBSP}U`;

/** Carbohydrate in whole grams: `105 g`. */
export const formatGrams = (grams: number): string => `${formatNumber(grams, 0)}${NBSP}g`;

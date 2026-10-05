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

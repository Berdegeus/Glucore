import { formatPercent } from '../../../../shared/presentation/format';
import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import type { DailyBucket } from '../../domain/summary';
import type { ChartAlternative } from './chartWidget';
import { fullDay, shortDay } from './dayLabel';
import { daySpan, valueSpan } from './summaryText';

export const DAILY_TIR_COLUMNS = ['Dia', 'Tempo no alvo'] as const;

/** One bar per day; a day with no readings has no percentage and leaves a gap, not a zero bar. */
export function dailyTirRows(byDay: readonly DailyBucket[]): ChartRow[] {
  return byDay.map((day) => ({ day: shortDay(day.day), tir: day.timeInRangePercent }));
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function dailyTirAlternative(byDay: readonly DailyBucket[]): ChartAlternative {
  const percents = byDay.flatMap((day) => (day.timeInRangePercent === null ? [] : [day.timeInRangePercent]));
  const span = valueSpan(percents, (value) => formatPercent(value));
  return {
    summary: `Tempo no alvo por dia${daySpan(byDay)}: ${span ?? 'sem dias com leituras'}.`,
    columns: DAILY_TIR_COLUMNS,
    rows: byDay.map((day) => [fullDay(day.day), formatPercent(day.timeInRangePercent)]),
  };
}

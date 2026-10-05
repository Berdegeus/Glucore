import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import { formatNumber } from '../../../../shared/presentation/format';
import type { CohortSummary } from '../../domain/cohort';
import type { CohortChartAlternative } from './cohortChartWidget';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export const HYPO_BY_HOUR_COLUMNS = ['Hora do dia', 'Episódios'] as const;

const hourLabel = (hour: number): string => `${hour}h`;

/** Episodes of each hour from 0 to 23, in order; an hour the gateway left out had none. */
function countsOf({ hypoByHour }: CohortSummary): [number, number][] {
  return HOURS.map((hour) => [hour, hypoByHour.find((slot) => slot.hour === hour)?.count ?? 0]);
}

/** One row per hour of the day: its label ("0h" to "23h") and the number of episodes. */
export function hypoByHourRows(cohort: CohortSummary): ChartRow[] {
  return countsOf(cohort).map(([hour, count]) => ({ hour: hourLabel(hour), count }));
}

const episodesText = (count: number): string => `${formatNumber(count, 0)} ${count === 1 ? 'episódio' : 'episódios'}`;

/** The sentence for screen readers: the total and the busiest hour, the first when two tie. */
function summaryOf(counts: readonly [number, number][]): string {
  const total = counts.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return 'Episódios de hipoglicemia por hora do dia: nenhum episódio no período.';
  const [peakHour, peak] = counts.reduce((best, slot) => (slot[1] > best[1] ? slot : best));
  return `Episódios de hipoglicemia por hora do dia: ${episodesText(total)} no total, mais frequentes às ${hourLabel(peakHour)} (${episodesText(peak)}).`;
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function hypoByHourAlternative(cohort: CohortSummary): CohortChartAlternative {
  const counts = countsOf(cohort);
  return {
    summary: summaryOf(counts),
    columns: HYPO_BY_HOUR_COLUMNS,
    rows: counts.map(([hour, count]) => [hourLabel(hour), formatNumber(count, 0)]),
  };
}

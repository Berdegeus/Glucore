import { formatMgdl, formatNumber } from '../../../../shared/presentation/format';
import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import type { DailyBucket } from '../../domain/summary';
import type { ChartAlternative } from './chartWidget';
import { fullDay, shortDay } from './dayLabel';
import { daySpan, valueSpan } from './summaryText';

/**
 * SPEC note: the summary does not carry the patient's own thresholds, so the
 * target band uses the backend's defaults (80 to 180 mg/dL) until it does.
 */
export const DEFAULT_TARGET_RANGE = { low: 80, high: 180 } as const;

export const TREND_COLUMNS = ['Dia', 'Média', 'Mínimo', 'Máximo', 'Média móvel de 7 dias'] as const;

/** One point per day for `LineBandChart`; a day with no readings leaves a gap, not a zero. */
export function trendRows(byDay: readonly DailyBucket[]): ChartRow[] {
  return byDay.map((day) => ({
    day: shortDay(day.day),
    avg: day.avgGlucose,
    min: day.minGlucose,
    max: day.maxGlucose,
    movingAvg: day.movingAvg7d,
  }));
}

function averagesSentence(byDay: readonly DailyBucket[]): string {
  const averages = byDay.flatMap((day) => (day.avgGlucose === null ? [] : [day.avgGlucose]));
  const span = valueSpan(averages, (value) => formatNumber(value, 0));
  return span === null ? 'sem média diária' : `média diária de ${span} mg/dL`;
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function trendAlternative(byDay: readonly DailyBucket[]): ChartAlternative {
  const { low, high } = DEFAULT_TARGET_RANGE;
  return {
    summary: `Tendência da glicose por dia${daySpan(byDay)}: ${averagesSentence(byDay)}, com faixa-alvo de ${low} a ${high} mg/dL.`,
    columns: TREND_COLUMNS,
    rows: byDay.map((day) => [
      fullDay(day.day),
      formatMgdl(day.avgGlucose),
      formatMgdl(day.minGlucose),
      formatMgdl(day.maxGlucose),
      formatMgdl(day.movingAvg7d),
    ]),
  };
}

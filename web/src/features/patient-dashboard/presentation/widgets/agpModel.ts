import { formatMgdl, formatNumber } from '../../../../shared/presentation/format';
import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import type { AgpPoint } from '../../domain/summary';
import type { ChartAlternative } from './chartWidget';
import { valueSpan } from './summaryText';

export const AGP_COLUMNS = ['Hora', 'P5', 'P25', 'Mediana', 'P75', 'P95', 'Leituras'] as const;

const HOURS_IN_DAY = 24;

export const hourLabel = (hour: number): string => `${hour}h`;

const byHour = (points: readonly AgpPoint[]): AgpPoint[] => [...points].sort((a, b) => a.hour - b.hour);

const NO_PERCENTILES = { p5: null, p25: null, p50: null, p75: null, p95: null } as const;

/** The 24 hours of the day, so the axis is whole; an hour with no readings has no percentiles and leaves a gap. */
export function agpRows(points: readonly AgpPoint[]): ChartRow[] {
  const found = new Map(points.map((point) => [point.hour, point]));
  return Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
    const { p5, p25, p50, p75, p95 } = found.get(hour) ?? NO_PERCENTILES;
    return { hour: hourLabel(hour), p5, p25, p50, p75, p95 };
  });
}

function coverage(sorted: readonly AgpPoint[]): string {
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 'sem horas com leituras';
  const medians = valueSpan(
    sorted.map((point) => point.p50),
    (value) => formatNumber(value, 0),
  );
  return `das ${hourLabel(first.hour)} às ${hourLabel(last.hour)}, mediana de ${medians} mg/dL`;
}

/** The sentence for screen readers and the table behind "Ver como tabela": only the hours with readings. */
export function agpAlternative(points: readonly AgpPoint[]): ChartAlternative {
  const sorted = byHour(points);
  return {
    summary: `Perfil ambulatorial da glicose por hora: ${coverage(sorted)}, com as faixas dos percentis 25 a 75 e 5 a 95.`,
    columns: AGP_COLUMNS,
    rows: sorted.map((point) => [
      hourLabel(point.hour),
      formatMgdl(point.p5),
      formatMgdl(point.p25),
      formatMgdl(point.p50),
      formatMgdl(point.p75),
      formatMgdl(point.p95),
      formatNumber(point.count, 0),
    ]),
  };
}

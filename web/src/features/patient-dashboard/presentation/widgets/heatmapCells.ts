import { formatMgdl, formatNumber } from '../../../../shared/presentation/format';
import type { HeatmapCellData } from '../../../../shared/presentation/charts/heatmapModel';
import type { HeatCell } from '../../domain/summary';
import { hourLabel } from './agpModel';
import type { ChartAlternative } from './chartWidget';
import { valueSpan } from './summaryText';

export const HEATMAP_COLUMNS = ['Dia da semana', 'Hora', 'Glicose média', 'Leituras'] as const;

/** Sunday first, as `dayOfWeek` counts: 0 is Sunday and 6 is Saturday. */
export const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;

const inOrder = (cells: readonly HeatCell[]): HeatCell[] => [...cells].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour);

/** The cells the heat map colors: one per weekday and hour that has readings. */
export function heatmapCells(cells: readonly HeatCell[]): HeatmapCellData[] {
  return cells.map((cell) => ({ day: cell.dayOfWeek, hour: cell.hour, value: cell.avgGlucose }));
}

/** The sentence for screen readers and the table behind "Ver como tabela": only the cells with readings. */
export function heatmapAlternative(cells: readonly HeatCell[]): ChartAlternative {
  const span = valueSpan(
    cells.map((cell) => cell.avgGlucose),
    (value) => formatNumber(value, 0),
  );
  const means = span === null ? 'sem leituras por dia da semana e hora' : `glicose média de ${span} mg/dL`;
  return {
    summary: `Mapa de calor da glicose por dia da semana e hora: ${means}; combinações de dia e hora com leituras: ${cells.length}.`,
    columns: HEATMAP_COLUMNS,
    rows: inOrder(cells).map((cell) => [
      WEEKDAY_NAMES[cell.dayOfWeek] ?? String(cell.dayOfWeek),
      hourLabel(cell.hour),
      formatMgdl(cell.avgGlucose),
      formatNumber(cell.count, 0),
    ]),
  };
}

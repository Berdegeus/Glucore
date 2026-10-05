import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import { EMPTY_VALUE, formatMgdl, formatTime } from '../../../../shared/presentation/format';
import type { DayDetail } from '../../application/loadDayDetail';
import type { ChartAlternative } from './chartWidget';
import { fullDay } from './dayLabel';
import { countOf, formatGrams, formatUnits, valueSpan } from './summaryText';

export const DAY_DETAIL_COLUMNS = ['Horário', 'Glicose', 'Carboidrato', 'Insulina'] as const;

export const GLUCOSE_SERIES = { key: 'glucose', label: 'Glicose' };
export const CARBS_MARKER_SERIES = { key: 'carbs', label: 'Carboidrato (marcador)', markerOnly: true };
export const INSULIN_MARKER_SERIES = { key: 'insulin', label: 'Insulina (marcador)', markerOnly: true };

const clock = (ms: number, timeZone: string): string => formatTime(new Date(ms), timeZone);

type PointRow = {
  time: string;
  glucose: number;
  carbs: number | null;
  insulin: number | null;
};

/** Index of the reading closest in time to `ms`. */
function nearestReading(detail: DayDetail, ms: number): number {
  let best = 0;
  detail.readings.forEach((reading, index) => {
    const closer = Math.abs(reading.timestampMs - ms) < Math.abs((detail.readings[best]?.timestampMs ?? 0) - ms);
    if (closer) best = index;
  });
  return best;
}

/**
 * One point per reading, in time order. A carbohydrate or insulin entry is a
 * marker on the point of the reading closest to it, at that reading's height,
 * so it sits on the curve instead of on an axis of its own (grams and units
 * are not mg/dL). The table gives each entry its own exact time.
 */
export function dayDetailRows(detail: DayDetail): ChartRow[] {
  const rows: PointRow[] = detail.readings.map((reading) => ({
    time: clock(reading.timestampMs, detail.timeZone),
    glucose: reading.value,
    carbs: null,
    insulin: null,
  }));
  const place = (ms: number, key: 'carbs' | 'insulin') => {
    const row = rows[nearestReading(detail, ms)];
    if (row) row[key] = row.glucose;
  };
  detail.carbs.forEach((entry) => place(entry.timeMs, 'carbs'));
  detail.insulin.forEach((entry) => place(entry.timeMs, 'insulin'));
  return rows;
}

interface TableEntry {
  at: number;
  cells: [string, string, string];
}

/** Every reading, carbohydrate and insulin entry of the day as a table row, by time. */
function tableRows(detail: DayDetail): string[][] {
  const { timeZone } = detail;
  const none = EMPTY_VALUE;
  const entries: TableEntry[] = [
    ...detail.readings.map((r): TableEntry => ({ at: r.timestampMs, cells: [formatMgdl(r.value), none, none] })),
    ...detail.carbs.map((c): TableEntry => ({ at: c.timeMs, cells: [none, `${formatGrams(c.grams)}${c.description ? ` (${c.description})` : ''}`, none] })),
    ...detail.insulin.map((i): TableEntry => ({ at: i.timeMs, cells: [none, none, `${formatUnits(i.units)} (${i.type})`] })),
  ];
  return entries.sort((a, b) => a.at - b.at).map((entry) => [clock(entry.at, timeZone), ...entry.cells]);
}

function entriesSentence(detail: DayDetail): string {
  const carbs = detail.carbs.length;
  const insulin = detail.insulin.length;
  if (carbs + insulin === 0) return 'sem registro de carboidrato ou insulina';
  const grams = formatGrams(detail.carbs.reduce((sum, entry) => sum + entry.grams, 0));
  const units = formatUnits(detail.insulin.reduce((sum, entry) => sum + entry.units, 0));
  return `${countOf(carbs, 'registro', 'registros')} de carboidrato (${grams}) e ${countOf(insulin, 'registro', 'registros')} de insulina (${units})`;
}

function readingsSentence(detail: DayDetail): string {
  const span = valueSpan(detail.readings.map((reading) => reading.value), formatMgdl);
  return span === null ? 'sem leituras' : `${countOf(detail.readings.length, 'leitura', 'leituras')}, de ${span}`;
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function dayDetailAlternative(detail: DayDetail): ChartAlternative {
  return {
    summary: `Glicose em ${fullDay(detail.day)}: ${readingsSentence(detail)}; ${entriesSentence(detail)}.`,
    columns: DAY_DETAIL_COLUMNS,
    tableCaption: `Leituras, carboidrato e insulina de ${fullDay(detail.day)}`,
    rows: tableRows(detail),
  };
}

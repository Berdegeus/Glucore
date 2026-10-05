export const DAYS = 7;
export const HOURS = 24;

/** Day labels with 0 = Sunday, as the API sends `dayOfWeek`. */
export const DEFAULT_DAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

export interface HeatmapCellData {
  /** 0 to 6, 0 = Sunday. */
  day: number;
  /** 0 to 23. */
  hour: number;
  /** `null` is a cell with no data. */
  value: number | null;
}

export interface GridCell {
  day: number;
  hour: number;
  value: number | null;
}

/** Cell edge below which hour labels thin out to every third hour. */
const LABEL_EVERY_HOUR_MIN = 22;
export const MIN_CELL = 10;

const inRange = (value: number, size: number) => Number.isInteger(value) && value >= 0 && value < size;

/**
 * The full 7 x 24 grid, day by day, hour by hour. A pair missing from `cells`,
 * out of range or without a number is an empty cell; a pair given twice keeps
 * the last value. So the grid never has more than 168 cells.
 */
export function buildGrid(cells: readonly HeatmapCellData[]): GridCell[] {
  const values = new Map<number, number | null>();
  for (const cell of cells) {
    if (inRange(cell.day, DAYS) && inRange(cell.hour, HOURS)) {
      values.set(cell.day * HOURS + cell.hour, Number.isFinite(cell.value) ? cell.value : null);
    }
  }
  return Array.from({ length: DAYS * HOURS }, (_, index) => ({
    day: Math.floor(index / HOURS),
    hour: index % HOURS,
    value: values.get(index) ?? null,
  }));
}

/** Smallest and largest value of the grid, or `null` when no cell has data. */
export function valueRange(grid: readonly GridCell[]): [number, number] | null {
  const values = grid.flatMap((cell) => (cell.value === null ? [] : [cell.value]));
  return values.length === 0 ? null : [Math.min(...values), Math.max(...values)];
}

const MIN_OPACITY = 0.18;

/** Opacity of the sequential scale: `MIN_OPACITY` at the low end, 1 at the high end. A flat range is all high. */
export function intensity(value: number, [min, max]: readonly [number, number]): number {
  if (max <= min) return 1;
  const share = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return MIN_OPACITY + (1 - MIN_OPACITY) * share;
}

/** Edge of a square cell for a chart `width` wide with `labelWidth` taken by the day labels. */
export function cellSize(width: number, labelWidth: number): number {
  return Math.max(MIN_CELL, Math.floor((width - labelWidth) / HOURS));
}

/** Label every hour when cells are wide enough to hold the text, every third hour otherwise. */
export function showHourLabel(hour: number, cell: number): boolean {
  return cell >= LABEL_EVERY_HOUR_MIN || hour % 3 === 0;
}

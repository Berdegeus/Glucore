import type { ReactElement } from 'react';
import { EMPTY_VALUE } from '../format';
import { CHART_COLORS } from './palette';
import { defaultFormat } from './chartDefaults';
import styles from './heatmapChart.module.css';
import {
  DAYS,
  DEFAULT_DAY_LABELS,
  HOURS,
  buildGrid,
  cellSize,
  intensity,
  showHourLabel,
  valueRange,
  type GridCell,
  type HeatmapCellData,
} from './heatmapModel';
import type { ValueFormatter } from './chartTypes';
import { useElementWidth } from './useElementWidth';

export interface HeatmapChartProps {
  /** One entry per day and hour that has a reading; the rest of the 7 x 24 grid stays empty. */
  cells: readonly HeatmapCellData[];
  /** Seven labels, Sunday first. */
  dayLabels?: readonly string[];
  /** Value range of the color scale; the range of the data by default. */
  domain?: readonly [number, number];
  formatValue?: ValueFormatter;
}

const LABEL_WIDTH = 36;
const TOP_MARGIN = 20;
const GAP = 2;
const FALLBACK_WIDTH = 600;
const SCALE_STEPS = [0, 0.25, 0.5, 0.75, 1];

interface Geometry {
  cell: number;
  dayLabels: readonly string[];
  range: readonly [number, number] | null;
  format: ValueFormatter;
}

function Cell({ cell, geometry }: { cell: GridCell; geometry: Geometry }) {
  const { cell: size, dayLabels, range, format } = geometry;
  const x = LABEL_WIDTH + cell.hour * size;
  const y = TOP_MARGIN + cell.day * size;
  const opacity = cell.value !== null && range ? intensity(cell.value, range) : null;
  const shown = cell.value === null ? EMPTY_VALUE : format(cell.value);
  return (
    <rect
      x={x + GAP / 2}
      y={y + GAP / 2}
      width={size - GAP}
      height={size - GAP}
      rx={2}
      data-day={cell.day}
      data-hour={cell.hour}
      data-empty={opacity === null ? 'true' : undefined}
      fill={opacity === null ? 'none' : 'var(--color-brand)'}
      fillOpacity={opacity ?? undefined}
      stroke={opacity === null ? CHART_COLORS.grid : 'none'}
      strokeOpacity={0.4}
    >
      <title>{`${dayLabels[cell.day]}, ${cell.hour}h: ${shown}`}</title>
    </rect>
  );
}

function AxisLabels({ geometry }: { geometry: Geometry }) {
  const { cell, dayLabels } = geometry;
  const text = { fill: CHART_COLORS.axis, fontSize: 12 } as const;
  return (
    <>
      {Array.from({ length: DAYS }, (_, day) => (
        <text key={day} x={LABEL_WIDTH - 6} y={TOP_MARGIN + day * cell + cell / 2} textAnchor="end" dominantBaseline="central" {...text}>
          {dayLabels[day]}
        </text>
      ))}
      {Array.from({ length: HOURS }, (_, hour) =>
        showHourLabel(hour, cell) ? (
          <text key={hour} x={LABEL_WIDTH + hour * cell + cell / 2} y={TOP_MARGIN - 6} textAnchor="middle" {...text}>
            {hour}
          </text>
        ) : null,
      )}
    </>
  );
}

function ColorScale({ range, format }: { range: readonly [number, number]; format: ValueFormatter }) {
  return (
    <div className={styles.scale}>
      <span>{format(range[0])}</span>
      <span className={styles.steps} aria-hidden="true">
        {SCALE_STEPS.map((step) => (
          <span key={step} className={styles.step} style={{ opacity: intensity(step, [0, 1]) }} />
        ))}
      </span>
      <span>{format(range[1])}</span>
    </div>
  );
}

/**
 * Weekday by hour heat map, drawn as plain SVG (Recharts has none): 168 cells at
 * most, empty where there is no data, each with a `<title>` of day, hour and
 * value. It measures its container and redraws on resize (PAC-10, RSP-05).
 */
export function HeatmapChart({
  cells,
  dayLabels = DEFAULT_DAY_LABELS,
  domain,
  formatValue = defaultFormat,
}: HeatmapChartProps): ReactElement {
  const [ref, width] = useElementWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const grid = buildGrid(cells);
  const range = domain ?? valueRange(grid);
  const cell = cellSize(width, LABEL_WIDTH);
  const geometry: Geometry = { cell, dayLabels, range, format: formatValue };
  const height = TOP_MARGIN + DAYS * cell;
  return (
    <div ref={ref} className={styles.heatmap} data-chart-container="">
      <svg className={styles.svg} width={LABEL_WIDTH + HOURS * cell} height={height} focusable="false">
        <AxisLabels geometry={geometry} />
        {grid.map((item) => (
          <Cell key={`${item.day}-${item.hour}`} cell={item} geometry={geometry} />
        ))}
      </svg>
      {range && <ColorScale range={range} format={formatValue} />}
    </div>
  );
}

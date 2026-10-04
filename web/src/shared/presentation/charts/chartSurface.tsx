import type { ReactElement } from 'react';
import { ResponsiveContainer, Symbols } from 'recharts';
import styles from './chartSurface.module.css';
import { DEFAULT_CHART_HEIGHT } from './chartDefaults';
import type { MarkerShape } from './palette';

const SWATCH_SIZE = 14;

export interface LegendItem {
  label: string;
  color: string;
  /** A marker shape for series told apart by shape; a plain swatch when absent (RSP-08). */
  marker?: MarkerShape;
  /** Opacity of the swatch, for bands and areas. */
  opacity?: number;
}

function LegendSymbol({ color, marker, opacity = 1 }: Omit<LegendItem, 'label'>) {
  return (
    <svg width={SWATCH_SIZE} height={SWATCH_SIZE} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {marker ? (
        <Symbols type={marker} cx={7} cy={7} size={70} fill={color} />
      ) : (
        <rect x={1} y={1} width={12} height={12} rx={2} fill={color} fillOpacity={opacity} stroke={color} />
      )}
    </svg>
  );
}

/** What each color and shape means. Plain HTML, so it reads as a list to a screen reader. */
export function SeriesLegend({ items }: { items: readonly LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label} className={styles.legendItem}>
          <LegendSymbol color={item.color} marker={item.marker} opacity={item.opacity} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

interface ChartSurfaceProps {
  /** A single Recharts chart: it takes the container's width, so it redraws when that changes (RSP-05). */
  children: ReactElement;
  height?: number;
  legend?: readonly LegendItem[];
}

export function ChartSurface({ children, height = DEFAULT_CHART_HEIGHT, legend = [] }: ChartSurfaceProps) {
  return (
    <div className={styles.surface}>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
      <SeriesLegend items={legend} />
    </div>
  );
}

interface MarkerDotProps {
  cx?: number | null;
  cy?: number | null;
  index?: number;
}

/** Dot renderer for `Line`, `Area` and `Scatter`: the series marker in the series color. */
export function markerDot(marker: MarkerShape, color: string) {
  return function MarkerDot({ cx, cy, index }: MarkerDotProps) {
    if (cx == null || cy == null) return <g key={index} />;
    return <Symbols key={index} type={marker} cx={cx} cy={cy} size={60} fill={color} stroke="var(--color-canvas)" />;
  };
}

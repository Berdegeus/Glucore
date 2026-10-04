import type { ReactElement } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AXIS_TICK,
  BASE_CHART_PROPS,
  GRID_PROPS,
  NO_ANIMATION,
  TOOLTIP_STYLE,
  defaultFormat,
  tooltipValue,
} from './chartDefaults';
import { ChartSurface, markerDot, type LegendItem } from './chartSurface';
import type { ChartRow, SeriesSpec, ValueFormatter } from './chartTypes';
import { seriesColor, seriesMarker } from './palette';

export interface LineSpec extends SeriesSpec {
  dashed?: boolean;
}

export interface BandSpec {
  minKey: string;
  maxKey: string;
  label: string;
}

export interface TargetRange {
  low: number;
  high: number;
  label: string;
}

export interface LineBandChartProps {
  data: readonly ChartRow[];
  /** Key of the category axis (a day, an hour). */
  xKey: string;
  lines: readonly LineSpec[];
  /** Shaded `[min, max]` band behind the lines. */
  band?: BandSpec;
  /** Horizontal target range, drawn behind everything (PAC-06). */
  targetRange?: TargetRange;
  /** Fill under each line. */
  filled?: boolean;
  /** Draw each series marker shape on the points. */
  markers?: boolean;
  height?: number;
  formatX?: (value: string) => string;
  formatY?: ValueFormatter;
}

export const BAND_DATA_KEY = '__band';

/** Adds the `[min, max]` pair Recharts reads for a range area; a gap in either end is a gap in the band. */
export function withBand(data: readonly ChartRow[], band: BandSpec | undefined): ChartRow[] {
  if (!band) return [...data];
  return data.map((row) => {
    const { [band.minKey]: min, [band.maxKey]: max } = row;
    const pair = typeof min === 'number' && typeof max === 'number' ? [min, max] : null;
    return { ...row, [BAND_DATA_KEY]: pair } as unknown as ChartRow;
  });
}

function renderSeries(spec: LineSpec, index: number, { filled, markers }: Pick<LineBandChartProps, 'filled' | 'markers'>) {
  const color = seriesColor(index);
  const shared = {
    dataKey: spec.key,
    name: spec.label,
    type: 'monotone' as const,
    stroke: color,
    strokeWidth: 2,
    strokeDasharray: spec.dashed ? '6 4' : undefined,
    dot: markers ? markerDot(seriesMarker(index), color) : false,
    activeDot: { r: 5 },
    connectNulls: false,
    ...NO_ANIMATION,
  };
  return filled ? <Area key={spec.key} {...shared} fill={color} fillOpacity={0.15} /> : <Line key={spec.key} {...shared} />;
}

function legendOf({ lines, band, targetRange, markers }: LineBandChartProps): LegendItem[] {
  const items: LegendItem[] = lines.map((line, index) => ({
    label: line.label,
    color: seriesColor(index),
    marker: markers ? seriesMarker(index) : undefined,
  }));
  if (band) items.push({ label: band.label, color: seriesColor(0), opacity: 0.2 });
  if (targetRange) items.push({ label: targetRange.label, color: 'var(--zone-target)', opacity: 0.2 });
  return items;
}

/**
 * One or more lines, with an optional min-max band and target range (PAC-06).
 * It receives prepared rows and knows nothing about readings or the API.
 */
export function LineBandChart(props: LineBandChartProps): ReactElement {
  const { data, xKey, lines, band, targetRange, height, formatX, formatY = defaultFormat } = props;
  return (
    <ChartSurface height={height} legend={legendOf(props)}>
      <ComposedChart data={withBand(data, band)} {...BASE_CHART_PROPS}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} tickFormatter={formatX} />
        <YAxis tick={AXIS_TICK} tickFormatter={formatY} width={48} />
        {targetRange && (
          <ReferenceArea y1={targetRange.low} y2={targetRange.high} fill="var(--zone-target)" fillOpacity={0.12} ifOverflow="extendDomain" />
        )}
        {band && (
          <Area
            dataKey={BAND_DATA_KEY}
            name={band.label}
            stroke="none"
            fill={seriesColor(0)}
            fillOpacity={0.2}
            dot={false}
            activeDot={false}
            {...NO_ANIMATION}
          />
        )}
        {lines.map((line, index) => renderSeries(line, index, props))}
        <Tooltip formatter={tooltipValue(formatY)} {...TOOLTIP_STYLE} />
      </ComposedChart>
    </ChartSurface>
  );
}

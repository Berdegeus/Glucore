import type { ReactElement } from 'react';
import {
  LabelList,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { AXIS_TICK, BASE_CHART_PROPS, NO_ANIMATION, TOOLTIP_STYLE, defaultFormat } from './chartDefaults';
import { ChartGrid, ChartSurface } from './chartSurface';
import type { ValueFormatter } from './chartTypes';
import { CHART_COLORS, seriesColor } from './palette';

export interface QuadrantAxis {
  /** Axis title, e.g. "Tempo no alvo (%)". */
  label: string;
  /** Where the reference line and the quadrant split sit (TIR 70, CV 36). */
  threshold: number;
  /** Visible range; the shaded quadrants fill it. */
  domain: readonly [number, number];
  format?: ValueFormatter;
}

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
}

type Side = 'above' | 'below';

export interface ScatterQuadrantChartProps {
  points: readonly ScatterPoint[];
  x: QuadrantAxis;
  y: QuadrantAxis;
  /** The quadrant drawn in the target color. Default: above on x, below on y (high TIR, low CV). */
  favorable?: { x: Side; y: Side };
  height?: number;
}

interface Quadrant {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  favorable: boolean;
}

/** The four rectangles the thresholds cut the plot into. */
export function quadrantsOf(x: QuadrantAxis, y: QuadrantAxis, favorable: { x: Side; y: Side }): Quadrant[] {
  const xSides: [Side, number, number][] = [
    ['below', x.domain[0], x.threshold],
    ['above', x.threshold, x.domain[1]],
  ];
  const ySides: [Side, number, number][] = [
    ['below', y.domain[0], y.threshold],
    ['above', y.threshold, y.domain[1]],
  ];
  return xSides.flatMap(([xSide, x1, x2]) =>
    ySides.map(([ySide, y1, y2]) => ({ x1, x2, y1, y2, favorable: xSide === favorable.x && ySide === favorable.y })),
  );
}

const axisTitle = { fill: CHART_COLORS.axis, fontSize: 12 } as const;

function QuadrantAxes({ x, y }: Pick<ScatterQuadrantChartProps, 'x' | 'y'>) {
  return (
    <>
      <XAxis
        type="number"
        dataKey="x"
        name={x.label}
        domain={[...x.domain]}
        tick={AXIS_TICK}
        tickFormatter={x.format ?? defaultFormat}
        label={{ ...axisTitle, value: x.label, position: 'insideBottom', offset: -16 }}
        height={44}
      />
      <YAxis
        type="number"
        dataKey="y"
        name={y.label}
        domain={[...y.domain]}
        tick={AXIS_TICK}
        tickFormatter={y.format ?? defaultFormat}
        label={{ ...axisTitle, value: y.label, angle: -90, position: 'insideLeft' }}
        width={48}
      />
    </>
  );
}

function PointTooltip({ x, y }: Pick<ScatterQuadrantChartProps, 'x' | 'y'>) {
  return function Content({ active, payload }: TooltipContentProps) {
    const point = payload?.[0]?.payload as ScatterPoint | undefined;
    if (!active || !point) return null;
    return (
      <div style={{ ...TOOLTIP_STYLE.contentStyle, padding: 'var(--space-2) var(--space-3)' }}>
        <strong>{point.label}</strong>
        <div>
          {x.label}: {(x.format ?? defaultFormat)(point.x)}
        </div>
        <div>
          {y.label}: {(y.format ?? defaultFormat)(point.y)}
        </div>
      </div>
    );
  };
}

/** Labelled points, reference lines at the thresholds and shaded quadrants: TIR against CV (PRO-10). */
export function ScatterQuadrantChart({
  points,
  x,
  y,
  favorable = { x: 'above', y: 'below' },
  height,
}: ScatterQuadrantChartProps): ReactElement {
  const color = seriesColor(0);
  return (
    <ChartSurface height={height}>
      <ScatterChart {...BASE_CHART_PROPS} margin={{ ...BASE_CHART_PROPS.margin, bottom: 24, left: 8 }}>
        <ChartGrid vertical />
        {quadrantsOf(x, y, favorable).map((quadrant) => (
          <ReferenceArea
            key={`${quadrant.x1}-${quadrant.y1}`}
            {...quadrant}
            fill={quadrant.favorable ? 'var(--zone-target)' : CHART_COLORS.grid}
            fillOpacity={quadrant.favorable ? 0.14 : 0.08}
            stroke="none"
          />
        ))}
        <QuadrantAxes x={x} y={y} />
        <ReferenceLine x={x.threshold} stroke={CHART_COLORS.axis} strokeDasharray="6 4" />
        <ReferenceLine y={y.threshold} stroke={CHART_COLORS.axis} strokeDasharray="6 4" />
        <Scatter data={[...points]} fill={color} stroke="var(--color-canvas)" {...NO_ANIMATION}>
          <LabelList dataKey="label" position="top" fill={CHART_COLORS.text} fontSize={12} />
        </Scatter>
        <Tooltip content={PointTooltip({ x, y })} cursor={false} />
      </ScatterChart>
    </ChartSurface>
  );
}

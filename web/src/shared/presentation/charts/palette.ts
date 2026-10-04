/*
 * Chart colors come from CSS custom properties (theme tokens), never hex, so a
 * chart follows the light and dark themes. Every series also gets a marker
 * shape, so a series is not told apart by color alone (RSP-08).
 */

export type MarkerShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'cross';

export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
] as const;

export const SERIES_MARKERS: readonly MarkerShape[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross'];

/** Neutral chart furniture. */
export const CHART_COLORS = {
  axis: 'var(--color-text-muted)',
  grid: 'var(--color-border)',
  text: 'var(--color-text)',
  surface: 'var(--color-surface)',
  brand: 'var(--color-brand)',
} as const;

/** Zone colors, in glucose order: urgent low to urgent high. */
export const ZONE_COLORS = [
  'var(--zone-urgent-low)',
  'var(--zone-low)',
  'var(--zone-target)',
  'var(--zone-high)',
  'var(--zone-urgent-high)',
] as const;

/** Color of the nth series; past the palette it starts over. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] as string;
}

/** Marker of the nth series; past the palette it starts over. */
export function seriesMarker(index: number): MarkerShape {
  return SERIES_MARKERS[index % SERIES_MARKERS.length] as MarkerShape;
}

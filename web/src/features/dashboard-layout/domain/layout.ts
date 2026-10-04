import type { Role } from '../../../shared/domain/role';

/** The sizes a widget can take on the grid (LAY-06); the same set as `contracts/widget-catalog.json`. */
export const WIDGET_SIZES = ['S', 'M', 'L'] as const;

export type WidgetSize = (typeof WIDGET_SIZES)[number];

/** A saved layout holds at most this many widgets (LAY-11). */
export const MAX_WIDGETS = 20;

/** What the catalog declares about a widget (LAY-01). The component itself is registered in `presentation`. */
export interface WidgetDefinition {
  id: string;
  /** Key of the widget's title; the text is resolved where it is shown. */
  titleKey: string;
  roles: readonly Role[];
  sizes: readonly WidgetSize[];
  defaultSize: WidgetSize;
}

export interface LayoutItem {
  readonly id: string;
  readonly size: WidgetSize;
}

/** The widgets on a dashboard, in display order. */
export interface DashboardLayout {
  readonly widgets: readonly LayoutItem[];
}

export type LayoutErrorReason = 'duplicate' | 'limit-reached' | 'size-not-allowed' | 'unknown-widget' | 'out-of-range';

/** A layout edit that breaks a rule. The editor disables such actions, so this marks a caller bug. */
export class LayoutError extends Error {
  constructor(readonly reason: LayoutErrorReason) {
    super(reason);
    this.name = 'LayoutError';
  }
}

function indexOfWidget(layout: DashboardLayout, id: string): number {
  const index = layout.widgets.findIndex((item) => item.id === id);
  if (index < 0) throw new LayoutError('unknown-widget');
  return index;
}

function assertAllowed(definition: WidgetDefinition, size: WidgetSize): void {
  if (!definition.sizes.includes(size)) throw new LayoutError('size-not-allowed');
}

/**
 * Appends a widget (LAY-03), by default at the size its definition prefers.
 * Fails on an id already present, on a size the widget does not declare, and
 * on a 21st widget.
 */
export function addWidget(layout: DashboardLayout, definition: WidgetDefinition, size: WidgetSize = definition.defaultSize): DashboardLayout {
  if (layout.widgets.some((item) => item.id === definition.id)) throw new LayoutError('duplicate');
  if (layout.widgets.length >= MAX_WIDGETS) throw new LayoutError('limit-reached');
  assertAllowed(definition, size);
  return { widgets: [...layout.widgets, { id: definition.id, size }] };
}

/** Drops a widget (LAY-03). */
export function removeWidget(layout: DashboardLayout, id: string): DashboardLayout {
  indexOfWidget(layout, id);
  return { widgets: layout.widgets.filter((item) => item.id !== id) };
}

/**
 * Puts a widget at `toIndex` (0 is first), shifting the ones in between. Both
 * a drag (LAY-04) and the "Mover para antes/depois" buttons (LAY-05) end here.
 * Moving to its own place changes nothing.
 */
export function moveWidget(layout: DashboardLayout, id: string, toIndex: number): DashboardLayout {
  const from = indexOfWidget(layout, id);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= layout.widgets.length) throw new LayoutError('out-of-range');
  const widgets = [...layout.widgets];
  const [moved] = widgets.splice(from, 1);
  widgets.splice(toIndex, 0, moved as LayoutItem);
  return { widgets };
}

/** Changes a widget's size among the ones its definition declares (LAY-06). */
export function resizeWidget(layout: DashboardLayout, definition: WidgetDefinition, size: WidgetSize): DashboardLayout {
  const index = indexOfWidget(layout, definition.id);
  assertAllowed(definition, size);
  return { widgets: layout.widgets.map((item, at) => (at === index ? { id: item.id, size } : item)) };
}

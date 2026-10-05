// Public API of the dashboard-layout feature (ARQ-15): what other features may import.
// A widget module needs its definition types, the props the grid hands it and the shell around it.
export { WIDGET_SIZES } from './domain/layout';
export type { WidgetDefinition, WidgetSize } from './domain/layout';
export type { WidgetProps } from './presentation/widgetRegistry';
export { SKELETON_HEIGHT, WidgetShell } from './presentation/widgetShell';
export type { WidgetState } from './presentation/widgetShell';

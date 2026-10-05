// Public API of the dashboard-layout feature (ARQ-15): what other features may import.
// A widget module needs its definition types, the props the grid hands it and the shell around it.
export { WIDGET_SIZES } from './domain/layout';
export { defaultLayoutFor } from './domain/defaultLayout';
export type { WidgetDefinition, WidgetSize } from './domain/layout';
export { allDefinitions, componentFor, definitionFor, definitionsForRole, registerWidget } from './presentation/widgetRegistry';
export type { WidgetProps } from './presentation/widgetRegistry';
export { SKELETON_HEIGHT, WidgetShell } from './presentation/widgetShell';
export { DashboardGrid, GridItem } from './presentation/dashboardGrid';
export { LayoutServicesProvider } from './presentation/layoutServices';
export { useLayout } from './presentation/useLayout';
export { LayoutEditorProvider } from './presentation/layoutEditorContext';
export { LayoutBoard } from './presentation/layoutBoard';
export { LayoutToolbar } from './presentation/layoutToolbar';
export { registerWidgetTitles, widgetTitle } from './presentation/widgetTitles';
export { UNAVAILABLE_WIDGET_TITLE, WidgetSlot } from './presentation/widgetSlot';
export type { WidgetState } from './presentation/widgetShell';
export { QueryWidget, queryWidgetState } from './presentation/queryWidget';

import type { DashboardLayout, LayoutItem, WidgetDefinition } from '../features/dashboard-layout/domain/layout';

/** A catalog entry for tests: every size allowed, `M` by default, patient-only. */
export function widgetDefinition(id: string, overrides: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return { id, titleKey: `widget.${id}`, roles: ['PATIENT'], sizes: ['S', 'M', 'L'], defaultSize: 'M', ...overrides };
}

export const layoutOf = (...widgets: LayoutItem[]): DashboardLayout => ({ widgets });

/** A layout of `S` widgets with the given ids. */
export const layoutOfIds = (...ids: string[]): DashboardLayout => layoutOf(...ids.map((id) => ({ id, size: 'S' as const })));

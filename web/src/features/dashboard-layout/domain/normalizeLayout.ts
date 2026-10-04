import type { Role } from '../../../shared/domain/role';
import type { DashboardLayout, LayoutItem, WidgetDefinition } from './layout';

/**
 * Cleans a saved layout against the catalog (LAY-10), so a widget that was
 * renamed, removed or never meant for this role cannot break the page. It
 * drops items whose id is unknown to the catalog, belongs to another role or
 * repeats an earlier item (the first one stays), and gives an item a size its
 * widget does not declare the widget's default size. The order of the rest
 * is kept; a layout that is already valid comes back equal.
 */
export function normalizeLayout(layout: DashboardLayout, catalog: readonly WidgetDefinition[], role: Role): DashboardLayout {
  const definitions = new Map(catalog.map((definition) => [definition.id, definition]));
  const seen = new Set<string>();
  const widgets: LayoutItem[] = [];

  for (const item of layout.widgets) {
    const definition = definitions.get(item.id);
    if (!definition?.roles.includes(role) || seen.has(item.id)) continue;
    seen.add(item.id);
    widgets.push(definition.sizes.includes(item.size) ? item : { id: item.id, size: definition.defaultSize });
  }
  return { widgets };
}

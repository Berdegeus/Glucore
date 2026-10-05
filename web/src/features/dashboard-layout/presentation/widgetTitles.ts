import type { WidgetDefinition } from '../domain/layout';

const titles = new Map<string, string>();

/**
 * Adds the text for widget `titleKey`s (`{ 'widget.kpi-tir': 'Tempo no alvo' }`). The texts sit
 * apart from the widget modules, so the editor can name a widget it has not loaded.
 */
export function registerWidgetTitles(entries: Readonly<Record<string, string>>): void {
  for (const [key, title] of Object.entries(entries)) titles.set(key, title);
}

/** The title shown for a widget; the id stands in until its text is registered. */
export function widgetTitle(definition: Pick<WidgetDefinition, 'id' | 'titleKey'>): string {
  return titles.get(definition.titleKey) ?? definition.id;
}

import type { LayoutItem } from '../domain/layout';
import { componentFor } from './widgetRegistry';
import { WidgetSlot } from './widgetSlot';

/** The widget of a layout item, loaded on demand; nothing for an id the registry does not know. */
export function WidgetContent({ item }: { item: LayoutItem }) {
  const component = componentFor(item.id);
  return component ? <WidgetSlot component={component} size={item.size} /> : null;
}

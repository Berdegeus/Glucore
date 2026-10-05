import type { DashboardLayout } from '../domain/layout';
import type { LayoutItemDto } from './schemas';

export function toLayout(dto: { widgets: readonly LayoutItemDto[] }): DashboardLayout {
  return { widgets: dto.widgets.map(({ id, size }) => ({ id, size })) };
}

/** The `PUT` body: only `id` and `size`, whatever else an item might carry. */
export function toLayoutDto(layout: DashboardLayout): { widgets: LayoutItemDto[] } {
  return { widgets: layout.widgets.map(({ id, size }) => ({ id, size })) };
}

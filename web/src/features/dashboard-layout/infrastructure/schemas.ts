import * as z from 'zod';
import { WIDGET_SIZES } from '../domain/layout';

const LayoutItemDtoSchema = z.object({
  id: z.string().min(1),
  size: z.enum(WIDGET_SIZES),
});

/** `GET /preferences/dashboard`: `widgets` is `null` until the person saves a layout. */
export const LoadedLayoutDtoSchema = z.object({ widgets: z.array(LayoutItemDtoSchema).nullable() });

/** `PUT /preferences/dashboard` answers with the layout it stored. */
export const SavedLayoutDtoSchema = z.object({ widgets: z.array(LayoutItemDtoSchema) });

export type LayoutItemDto = z.infer<typeof LayoutItemDtoSchema>;
export type LoadedLayoutDto = z.infer<typeof LoadedLayoutDtoSchema>;
export type SavedLayoutDto = z.infer<typeof SavedLayoutDtoSchema>;

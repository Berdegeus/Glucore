import {
  BadRequestError,
  MAX_LAYOUT_WIDGETS,
  WIDGET_IDS_BY_ROLE,
  WIDGET_SIZES,
  type UserRoleName,
  type WidgetSize,
} from '@glucore/shared';

/** Code carried by every layout 400; the web decides on it, never on the message. */
export const INVALID_LAYOUT = 'INVALID_LAYOUT';

export interface LayoutItem {
  id: string;
  size: WidgetSize;
}

export interface DashboardLayoutInput {
  widgets: LayoutItem[];
}

function invalid(reason: string): BadRequestError {
  return new BadRequestError(`Invalid layout: ${reason}`, INVALID_LAYOUT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === 'string' && (WIDGET_SIZES as readonly string[]).includes(value);
}

/**
 * Validates a `PUT /preferences/dashboard` body against the role's catalog.
 *
 * Only `widgets` is read, and each item is rebuilt from `id` and `size`, so a
 * user id sent in the body (or anything else) never reaches storage: the owner
 * comes from the token alone. Any problem rejects the whole body, so nothing is
 * written.
 *
 * `catalog` defaults to the shared one. It is a parameter because no role has
 * more than 16 widgets today, which leaves the 20-item limit unreachable with
 * real ids; a test needs a larger catalog to exercise it.
 */
export function parseLayout(
  body: unknown,
  role: UserRoleName,
  catalog: Readonly<Record<UserRoleName, readonly string[]>> = WIDGET_IDS_BY_ROLE,
): DashboardLayoutInput {
  if (!isRecord(body)) throw invalid('body must be an object');
  if (!Array.isArray(body.widgets)) throw invalid('widgets must be an array');
  if (body.widgets.length > MAX_LAYOUT_WIDGETS) {
    throw invalid(`at most ${MAX_LAYOUT_WIDGETS} widgets`);
  }

  const allowed = catalog[role];
  const seen = new Set<string>();
  const widgets = body.widgets.map((item: unknown): LayoutItem => {
    if (!isRecord(item) || typeof item.id !== 'string' || !allowed.includes(item.id)) {
      throw invalid('unknown widget for this role');
    }
    if (seen.has(item.id)) throw invalid(`widget ${item.id} repeated`);
    if (!isWidgetSize(item.size)) throw invalid(`size must be one of ${WIDGET_SIZES.join(', ')}`);
    seen.add(item.id);
    return { id: item.id, size: item.size };
  });

  return { widgets };
}

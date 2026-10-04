import type { UserRoleName } from '@glucore/shared';

import type { PreferencesRepository } from './preferences.repository';
import { parseLayout, type LayoutItem } from './preferences.schema';

export interface DashboardLayoutDto {
  /** `null` means "no saved layout": the web applies the role's default. */
  widgets: LayoutItem[] | null;
}

/**
 * The dashboard layout of the caller, and only the caller.
 *
 * `userId` and `role` always come from the verified token; nothing in the body
 * can name another user (LAY-12). The role decides which catalog the layout is
 * validated against, so a professional cannot save a patient widget.
 */
export class PreferencesService {
  constructor(private readonly preferences: PreferencesRepository) {}

  async get(userId: string): Promise<DashboardLayoutDto> {
    return { widgets: await this.preferences.find(userId) };
  }

  /** Throws `400 INVALID_LAYOUT` before touching storage when the body is invalid. */
  async save(userId: string, role: UserRoleName, body: unknown): Promise<DashboardLayoutDto> {
    const { widgets } = parseLayout(body, role);
    return { widgets: await this.preferences.upsert(userId, widgets) };
  }

  async reset(userId: string): Promise<void> {
    await this.preferences.delete(userId);
  }
}

import type { Prisma, PrismaClient } from '../../lib/prisma';

import type { LayoutItem } from './preferences.schema';

/**
 * Storage for the dashboard layout, one row per user.
 *
 * Every method is keyed by the user id the service got from the token; there
 * is no lookup by anything a client can choose.
 */
export interface PreferencesRepository {
  /** `null` when the user never saved a layout (or reset it). */
  find(userId: string): Promise<LayoutItem[] | null>;
  /** Last write wins: there is no version to compare against. */
  upsert(userId: string, widgets: LayoutItem[]): Promise<LayoutItem[]>;
  /** Idempotent: resetting a layout that does not exist is a success. */
  delete(userId: string): Promise<void>;
}

export class PrismaPreferencesRepository implements PreferencesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(userId: string): Promise<LayoutItem[] | null> {
    const row = await this.prisma.dashboardLayout.findUnique({
      where: { userId },
      select: { widgets: true },
    });
    // Only parseLayout's output is ever written, so the stored JSON has that shape.
    return row ? (row.widgets as unknown as LayoutItem[]) : null;
  }

  async upsert(userId: string, widgets: LayoutItem[]): Promise<LayoutItem[]> {
    const json = widgets as unknown as Prisma.InputJsonValue;
    const row = await this.prisma.dashboardLayout.upsert({
      where: { userId },
      update: { widgets: json },
      create: { userId, widgets: json },
      select: { widgets: true },
    });
    return row.widgets as unknown as LayoutItem[];
  }

  async delete(userId: string): Promise<void> {
    // deleteMany rather than delete: no row is not an error here.
    await this.prisma.dashboardLayout.deleteMany({ where: { userId } });
  }
}

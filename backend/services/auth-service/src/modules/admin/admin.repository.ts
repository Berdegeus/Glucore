import {
  fillDayCounts,
  utcPeriodDayKeys,
  utcPeriodStart,
  type DayCount,
} from '@glucore/shared';

import { UserRole, UserStatus, type PrismaClient } from '../../lib/prisma';

export interface AccountStats {
  accounts: {
    total: number;
    byRole: { role: UserRole; count: number }[];
    byStatus: { status: UserStatus; count: number }[];
  };
  registrationsInPeriod: number;
  registrationsByDay: DayCount[];
}

/** Everything the admin module needs from the identity database. */
export interface AdminRepository {
  /**
   * Account counts and sign-ups per UTC day over the last `days` calendar days,
   * ending with `now`'s day.
   */
  accountStats(days: number, now: Date): Promise<AccountStats>;
}

const ROLES = Object.values(UserRole) as UserRole[];
const STATUSES = Object.values(UserStatus) as UserStatus[];

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async accountStats(days: number, now: Date): Promise<AccountStats> {
    const start = utcPeriodStart(days, now);

    const [roleRows, statusRows, dayRows] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      // `createdAt` is a timestamp without zone that Prisma writes in UTC, so
      // formatting it as-is buckets by UTC day. Raw because `groupBy` cannot
      // truncate a timestamp to a day.
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
        FROM "User"
        WHERE "createdAt" >= ${start}
        GROUP BY 1
      `,
    ]);

    const byRole = ROLES.map((role) => ({
      role,
      count: roleRows.find((row) => row.role === role)?._count._all ?? 0,
    }));
    const byStatus = STATUSES.map((status) => ({
      status,
      count: statusRows.find((row) => row.status === status)?._count._all ?? 0,
    }));

    const registrationsByDay = fillDayCounts(utcPeriodDayKeys(days, now), dayRows);

    return {
      accounts: {
        total: byRole.reduce((sum, row) => sum + row.count, 0),
        byRole,
        byStatus,
      },
      registrationsInPeriod: registrationsByDay.reduce((sum, row) => sum + row.count, 0),
      registrationsByDay,
    };
  }
}

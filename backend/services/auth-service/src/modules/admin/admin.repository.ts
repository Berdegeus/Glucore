import {
  fillDayCounts,
  utcPeriodDayKeys,
  utcPeriodStart,
  type DayCount,
} from '@glucore/shared';

import { UserRole, UserStatus, type Prisma, type PrismaClient } from '../../lib/prisma';

import type { AdminUserSource } from './admin.mapper';

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
  /**
   * One page of accounts, newest first (ties broken by id so pages never
   * overlap). `q` is plain text: the repository makes it literal.
   */
  listUsers(
    filter: UserListFilter,
    paging: { skip: number; take: number },
  ): Promise<{ rows: AdminUserSource[]; total: number }>;
}

export interface UserListFilter {
  role?: UserRole;
  status?: UserStatus;
  q?: string;
}

/** Makes `%`, `_` and `\` literal in a LIKE pattern, so a search for "50%" is not "50 anything". */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const LIST_FIELDS = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

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

  async listUsers(
    filter: UserListFilter,
    paging: { skip: number; take: number },
  ): Promise<{ rows: AdminUserSource[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };
    if (filter.q) {
      // Prisma's `contains` wraps the value in `%…%` without escaping it, so the
      // escape here is what keeps a literal `%` from acting as a wildcard.
      const needle = escapeLikePattern(filter.q);
      where.OR = [
        { fullName: { contains: needle, mode: 'insensitive' } },
        { email: { contains: needle, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: LIST_FIELDS,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: paging.skip,
        take: paging.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { rows, total };
  }
}

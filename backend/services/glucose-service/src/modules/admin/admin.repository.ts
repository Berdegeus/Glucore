import {
  fillDayCounts,
  utcPeriodDayKeys,
  utcPeriodStart,
  utcPeriodWeekKeys,
  utcWeekStart,
  type DayCount,
} from '@glucore/shared';
import { AlertType, type PrismaClient } from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Platform-wide counts for the administrator, and nothing else: no patient id,
 * no user id, no reading value, no alert text (ADM-03). The shape cannot carry
 * them, so a later query cannot leak one by accident.
 */
export interface PlatformStats {
  activePatients: {
    /** Patients with at least one reading in the last 24 hours. */
    last24h: number;
    /** Patients with at least one reading in the last 7 days. */
    last7d: number;
    /** Patients registered, active or not. */
    registered: number;
  };
  readingsByDay: DayCount[];
  grants: {
    /** Not revoked and not expired at `now`. */
    active: number;
    /** Grants created per ISO week (Monday, UTC), for the weeks the period overlaps. */
    createdByWeek: { weekStart: string; count: number }[];
  };
  /** Alerts triggered in the period, every type listed. */
  alertsByType: { alertType: AlertType; count: number }[];
}

export interface AdminRepository {
  /** Counts over the last `days` UTC calendar days, ending with `now`'s day. */
  platformStats(days: number, now: Date): Promise<PlatformStats>;
}

const ALERT_TYPES = Object.values(AlertType) as AlertType[];

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async platformStats(days: number, now: Date): Promise<PlatformStats> {
    const start = utcPeriodStart(days, now);
    const weekKeys = utcPeriodWeekKeys(days, now);
    const firstWeek = utcWeekStart(start);

    const [registered, last24h, last7d, readingRows, active, weekRows, alertRows] = await Promise.all([
      this.prisma.patient.count(),
      this.activePatients(new Date(now.getTime() - 24 * HOUR_MS)),
      this.activePatients(new Date(now.getTime() - 7 * 24 * HOUR_MS)),
      // Raw because `groupBy` cannot truncate a timestamp to a day. `recordedAt`
      // is a timestamp without zone that Prisma writes in UTC, so formatting it
      // as-is buckets by UTC day. The BRIN index on `recordedAt` serves the scan.
      // A Date parameter reaches Postgres as timestamptz, and comparing that with
      // a zoneless column goes through the session time zone; `AT TIME ZONE 'UTC'`
      // keeps the bound in UTC whatever the server is set to.
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char("recordedAt", 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
        FROM "GlucoseReading"
        WHERE "recordedAt" >= (${start}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
      `,
      this.prisma.dashboardAccessGrant.count({
        where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      // Postgres' week starts on Monday, matching `utcWeekStart`.
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(date_trunc('week', "grantedAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
        FROM "DashboardAccessGrant"
        WHERE "grantedAt" >= (${firstWeek}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
      `,
      this.prisma.alertEvent.groupBy({
        by: ['alertType'],
        where: { triggeredAt: { gte: start } },
        _count: { _all: true },
      }),
    ]);

    return {
      activePatients: { last24h, last7d, registered },
      readingsByDay: fillDayCounts(utcPeriodDayKeys(days, now), readingRows),
      grants: {
        active,
        createdByWeek: fillDayCounts(weekKeys, weekRows).map(({ day, count }) => ({
          weekStart: day,
          count,
        })),
      },
      alertsByType: ALERT_TYPES.map((alertType) => ({
        alertType,
        count: alertRows.find((row) => row.alertType === alertType)?._count._all ?? 0,
      })),
    };
  }

  private async activePatients(since: Date): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT "patientId")::int AS count
      FROM "GlucoseReading"
      WHERE "recordedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC')
    `;
    return row.count;
  }
}

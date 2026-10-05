import type { PrismaClient } from '@prisma/client';

import { toNumber } from '../dashboard/dashboard.mapper';

/** PRO-16: 50 patients a page unless the caller asks for another size. */
export const DEFAULT_PATIENT_PAGE_LIMIT = 50;

/** PRO-16: the most one page (and the cohort aggregates) ever holds. */
export const MAX_PATIENT_PAGE_LIMIT = 200;

export interface GrantedPatientPage {
  /** Ids on the requested page, oldest active grant first. */
  ids: string[];
  /** Every distinct patient with an active grant, regardless of the page. */
  total: number;
}

export interface PatientPageRequest {
  /** 1-based. */
  page?: number;
  limit?: number;
}

/**
 * The patients a professional can see: those with an active grant, active being
 * `revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt > now)` like every other
 * grant read. Distinct by patient, so a duplicated grant row cannot list one
 * patient twice. The order is the grant date and then the id, which keeps pages
 * stable and makes "the first 200" mean "the oldest 200 links".
 *
 * `limit` is capped at `MAX_PATIENT_PAGE_LIMIT` here as well as at the edge, so
 * no caller can build an unbounded `IN` list for the metrics query.
 *
 * `now` is bound with `AT TIME ZONE 'UTC'` for the reason documented on
 * `PrismaDashboardRepository.getPeriodMetrics`: `expiresAt` is a naive UTC timestamp.
 */
export async function listGrantedPatientIds(
  prisma: PrismaClient,
  professionalId: string,
  now: Date,
  { page = 1, limit = DEFAULT_PATIENT_PAGE_LIMIT }: PatientPageRequest = {},
): Promise<GrantedPatientPage> {
  const pageSize = Math.min(Math.max(1, limit), MAX_PATIENT_PAGE_LIMIT);
  const offset = (Math.max(1, page) - 1) * pageSize;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<Array<{ patient_id: string }>>`
      SELECT "patientId" AS patient_id
      FROM "DashboardAccessGrant"
      WHERE "healthProfessionalId" = ${professionalId}::uuid
        AND "revokedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > (${now} AT TIME ZONE 'UTC'))
      GROUP BY "patientId"
      ORDER BY MIN("grantedAt"), "patientId"
      LIMIT ${pageSize}::integer OFFSET ${offset}::integer
    `,
    prisma.$queryRaw<Array<{ total: unknown }>>`
      SELECT COUNT(DISTINCT "patientId") AS total
      FROM "DashboardAccessGrant"
      WHERE "healthProfessionalId" = ${professionalId}::uuid
        AND "revokedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > (${now} AT TIME ZONE 'UTC'))
    `,
  ]);

  return { ids: rows.map((row) => row.patient_id), total: toNumber(totals[0]?.total) };
}

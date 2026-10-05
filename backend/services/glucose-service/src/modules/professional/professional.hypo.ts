import type { PrismaClient } from '@prisma/client';

import { toNumber } from '../dashboard/dashboard.mapper';
import type { DateRange } from '../dashboard/dashboard.repository';
import { cohortCtes } from './professional.sql';

/** How many hypo episodes began during one local hour of the day. */
export interface HypoHourCount {
  /** 0..23, in the zone the caller asked for. */
  hour: number;
  count: number;
}

/**
 * Sustained hypo episodes of all `ids` bucketed by the local hour they started
 * in (PRO-10). The episodes are the ones the patient summary lists as `HYPO`
 * excursions (see `cohortCtes`), so the hour chart and the per-patient counts
 * add up to the same events. Only hours with at least one episode are returned,
 * in ascending order; the service pads the rest with zeros.
 *
 * The start is a naive UTC timestamp: read as UTC first, then shown as `tz`
 * wall clock, like the other hour-of-day queries.
 */
export async function getHypoStartHours(
  prisma: PrismaClient,
  ids: readonly string[],
  range: DateRange,
  tz: string,
): Promise<HypoHourCount[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.$queryRaw<Array<{ hour: unknown; episodes: unknown }>>`
    WITH ${cohortCtes(ids, range)}
    SELECT
      EXTRACT(HOUR FROM (started_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::integer AS hour,
      COUNT(*) AS episodes
    FROM hypo_episodes
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((row) => ({ hour: toNumber(row.hour), count: toNumber(row.episodes) }));
}

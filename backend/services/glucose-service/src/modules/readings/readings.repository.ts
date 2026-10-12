import type { GlucoseReading, PrismaClient } from '@prisma/client';

import type { PageQuery } from '@glucore/shared';

import type { ReadingInput } from './readings.schema';

export interface IReadingRepository {
  /**
   * Newest samples first, within `[from, before)` when those are given. A full
   * page is the caller's cue to ask again with `before` set to its oldest row.
   */
  listPage(patientId: string, page: PageQuery): Promise<GlucoseReading[]>;
  /**
   * Writes a batch atomically, keyed by [patientId, recordedAt].
   *
   * The transaction is the repository's business: a partially applied sync
   * would leave the chart with a hole no retry closes, and the service must not
   * have to know that.
   */
  upsertMany(patientId: string, readings: readonly ReadingInput[]): Promise<void>;
  deleteAll(patientId: string): Promise<void>;
}

export class PrismaReadingRepository implements IReadingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listPage(patientId: string, { from, before, limit }: PageQuery): Promise<GlucoseReading[]> {
    return this.prisma.glucoseReading.findMany({
      where: {
        patientId,
        ...(from !== undefined || before !== undefined
          ? {
              recordedAt: {
                ...(from !== undefined ? { gte: new Date(from) } : {}),
                ...(before !== undefined ? { lt: new Date(before) } : {}),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  async upsertMany(patientId: string, readings: readonly ReadingInput[]): Promise<void> {
    // The same instant twice in one statement would make ON CONFLICT DO UPDATE
    // fail ("cannot affect row a second time"). The last one wins, as it did
    // when the upserts ran one after another.
    const byInstant = new Map<number, ReadingInput>();
    for (const reading of readings) byInstant.set(reading.timestampMs, reading);
    if (byInstant.size === 0) return;

    const batch = [...byInstant.values()];
    // `recordedAt` is a naive `timestamp(3)`; an ISO string with its `Z` cast to
    // `timestamp` keeps the UTC wall clock, which is what the column holds.
    const recordedAt = batch.map((r) => new Date(r.timestampMs).toISOString());
    const trends = batch.map((r) => r.trend);
    // Numbers travel as text and are cast in SQL. Prisma encodes a JS number
    // array as int or float depending on what the values happen to be, and
    // Postgres reuses the prepared statement from the first batch: an all-integer
    // `rate` column followed by a fractional one fails with 22P03.
    const values = batch.map((r) => String(Math.round(r.value)));
    const rates = batch.map((r) => String(r.rate ?? 0));
    // No NULL inside an array either: an all-null (or mixed) array has no type
    // Prisma can infer, and it fails the same way (08P01). Empty means "none".
    const alarms = batch.map((r) => (r.alarmCode == null ? '' : String(r.alarmCode)));

    // One statement instead of one upsert per row: it is atomic by itself (a
    // partially applied sync would leave a hole no retry closes) and costs one
    // round trip. A resend that changes nothing writes nothing: IS DISTINCT FROM
    // skips the row, so no dead tuples pile up from retried batches. A missing
    // alarm keeps the stored one, as the old per-row update did.
    await this.prisma.$executeRaw`
      INSERT INTO "GlucoseReading"
        ("patientId", "recordedAt", "valueMgDl", "trend", "trendRate", "alarmCode")
      SELECT ${patientId}::uuid, r."recordedAt", r."valueMgDl", r."trend", r."trendRate",
        NULLIF(r."alarmCode", '')::int
      FROM unnest(
        ${recordedAt}::timestamp[],
        ${values}::text[]::int[],
        ${trends}::text[],
        ${rates}::text[]::float8[],
        ${alarms}::text[]
      ) AS r("recordedAt", "valueMgDl", "trend", "trendRate", "alarmCode")
      ON CONFLICT ("patientId", "recordedAt") DO UPDATE SET
        "valueMgDl" = EXCLUDED."valueMgDl",
        "trend" = EXCLUDED."trend",
        "trendRate" = EXCLUDED."trendRate",
        "alarmCode" = COALESCE(EXCLUDED."alarmCode", "GlucoseReading"."alarmCode")
      WHERE (
        "GlucoseReading"."valueMgDl",
        "GlucoseReading"."trend",
        "GlucoseReading"."trendRate",
        "GlucoseReading"."alarmCode"
      ) IS DISTINCT FROM (
        EXCLUDED."valueMgDl",
        EXCLUDED."trend",
        EXCLUDED."trendRate",
        COALESCE(EXCLUDED."alarmCode", "GlucoseReading"."alarmCode")
      )
    `;
  }

  async deleteAll(patientId: string): Promise<void> {
    await this.prisma.glucoseReading.deleteMany({ where: { patientId } });
  }
}

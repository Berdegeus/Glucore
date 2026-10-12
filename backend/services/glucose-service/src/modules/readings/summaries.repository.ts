import type { PrismaClient } from '@prisma/client';

import type { DailySummaryInput } from './summaries.schema';

export interface ISummaryRepository {
  /**
   * Writes a batch atomically, keyed by [patientId, localDate].
   *
   * A day only ever grows: a row replaces the stored one when it counts at least
   * as many readings. The app cuts a day from the readings it still holds, so a
   * day at the edge of its retention window (or one rebuilt after a reinstall,
   * from the server's 5-minute thinning) is smaller than what the server
   * already has, and must not overwrite it.
   */
  upsertMany(patientId: string, days: readonly DailySummaryInput[]): Promise<void>;
  deleteAll(patientId: string): Promise<void>;
}

export class PrismaSummaryRepository implements ISummaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMany(patientId: string, days: readonly DailySummaryInput[]): Promise<void> {
    if (days.length === 0) return;

    // The whole batch goes in as one JSON document and is unpacked in SQL: a
    // histogram is an array inside a row, and Prisma cannot type nested arrays
    // as parameters (see the note in readings.repository.ts).
    const payload = JSON.stringify(days);

    await this.prisma.$executeRaw`
      INSERT INTO "GlucoseDailySummary"
        ("patientId", "localDate", "utcOffsetMinutes", "readingsCount", "coveredSlots", "histogram")
      SELECT
        ${patientId}::uuid,
        d."localDate",
        d."utcOffsetMinutes",
        d."readingsCount",
        d."coveredSlots",
        ARRAY(SELECT jsonb_array_elements_text(d."histogram")::int)
      FROM jsonb_to_recordset(${payload}::jsonb) AS d(
        "localDate" date,
        "utcOffsetMinutes" int,
        "readingsCount" int,
        "coveredSlots" int,
        "histogram" jsonb
      )
      ON CONFLICT ("patientId", "localDate") DO UPDATE SET
        "utcOffsetMinutes" = EXCLUDED."utcOffsetMinutes",
        "readingsCount" = EXCLUDED."readingsCount",
        "coveredSlots" = EXCLUDED."coveredSlots",
        "histogram" = EXCLUDED."histogram",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE EXCLUDED."readingsCount" >= "GlucoseDailySummary"."readingsCount"
    `;
  }

  async deleteAll(patientId: string): Promise<void> {
    await this.prisma.glucoseDailySummary.deleteMany({ where: { patientId } });
  }
}

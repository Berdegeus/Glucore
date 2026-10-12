import type { PrismaClient } from '@prisma/client';

import type { GlucoseBucketInput } from './buckets.schema';

export interface IBucketRepository {
  /**
   * Writes a batch atomically, keyed by [patientId, bucketStart].
   *
   * An interval only ever grows: a row replaces the stored one when it counts at
   * least as many readings. The app builds an interval from the readings it
   * still holds, so one at the edge of its retention window (or rebuilt after a
   * reinstall, from the server's 5-minute thinning) is smaller than what the
   * server already has, and must not overwrite it.
   */
  upsertMany(patientId: string, buckets: readonly GlucoseBucketInput[]): Promise<void>;
  deleteAll(patientId: string): Promise<void>;
}

export class PrismaBucketRepository implements IBucketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMany(patientId: string, buckets: readonly GlucoseBucketInput[]): Promise<void> {
    if (buckets.length === 0) return;

    // The whole batch goes in as one JSON document and is unpacked in SQL: a
    // bucket carries two arrays, and Prisma cannot type nested arrays as
    // parameters (see the note in readings.repository.ts).
    const payload = JSON.stringify(buckets);

    await this.prisma.$executeRaw`
      INSERT INTO "GlucoseBucket"
        ("patientId", "bucketStart", "readingsCount", "coveredSlots", "mgDl", "counts")
      SELECT
        ${patientId}::uuid,
        to_timestamp(b."startMs" / 1000.0) AT TIME ZONE 'UTC',
        b."readingsCount",
        b."coveredSlots",
        ARRAY(SELECT jsonb_array_elements_text(b."mgDl")::int),
        ARRAY(SELECT jsonb_array_elements_text(b."counts")::int)
      FROM jsonb_to_recordset(${payload}::jsonb) AS b(
        "startMs" bigint,
        "readingsCount" int,
        "coveredSlots" int,
        "mgDl" jsonb,
        "counts" jsonb
      )
      ON CONFLICT ("patientId", "bucketStart") DO UPDATE SET
        "readingsCount" = EXCLUDED."readingsCount",
        "coveredSlots" = EXCLUDED."coveredSlots",
        "mgDl" = EXCLUDED."mgDl",
        "counts" = EXCLUDED."counts",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE EXCLUDED."readingsCount" >= "GlucoseBucket"."readingsCount"
    `;
  }

  async deleteAll(patientId: string): Promise<void> {
    await this.prisma.glucoseBucket.deleteMany({ where: { patientId } });
  }
}

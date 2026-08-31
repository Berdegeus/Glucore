import type { GlucoseReading, PrismaClient } from '@prisma/client';

import type { ReadingInput } from './readings.schema';

export interface IReadingRepository {
  /** Most recent samples first. */
  listRecent(patientId: string, limit: number): Promise<GlucoseReading[]>;
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

  listRecent(patientId: string, limit: number): Promise<GlucoseReading[]> {
    return this.prisma.glucoseReading.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  async upsertMany(patientId: string, readings: readonly ReadingInput[]): Promise<void> {
    await this.prisma.$transaction(
      readings.map((reading) => {
        const recordedAt = new Date(reading.timestampMs);
        return this.prisma.glucoseReading.upsert({
          where: { patientId_recordedAt: { patientId, recordedAt } },
          update: {
            valueMgDl: Math.round(reading.value),
            trend: reading.trend,
            trendRate: reading.rate,
            alarmCode: reading.alarmCode,
          },
          create: {
            patientId,
            valueMgDl: Math.round(reading.value),
            recordedAt,
            trend: reading.trend,
            trendRate: reading.rate ?? 0,
            alarmCode: reading.alarmCode,
          },
        });
      }),
    );
  }

  async deleteAll(patientId: string): Promise<void> {
    await this.prisma.glucoseReading.deleteMany({ where: { patientId } });
  }
}

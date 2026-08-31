import type { CarbEvent, PrismaClient } from '@prisma/client';

import type { CarbInput } from './carbs.schema';

/** A create carries an optional client-minted id; an update never does. */
export type CarbCreate = CarbInput & { id?: string };

export interface ICarbRepository {
  listRecent(patientId: string, limit: number): Promise<CarbEvent[]>;
  create(patientId: string, entry: CarbCreate): Promise<CarbEvent>;
  /** Scoped by patient, so an id belonging to someone else updates nothing. */
  update(patientId: string, id: string, entry: CarbInput): Promise<number>;
  delete(patientId: string, id: string): Promise<number>;
  replaceAll(patientId: string, entries: readonly CarbCreate[]): Promise<void>;
}

export class PrismaCarbRepository implements ICarbRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listRecent(patientId: string, limit: number): Promise<CarbEvent[]> {
    return this.prisma.carbEvent.findMany({
      where: { patientId },
      orderBy: { eventAt: 'desc' },
      take: limit,
    });
  }

  create(patientId: string, entry: CarbCreate): Promise<CarbEvent> {
    return this.prisma.carbEvent.create({
      data: {
        ...(entry.id ? { id: entry.id } : {}),
        patientId,
        carbsGrams: entry.grams,
        description: entry.description,
        eventAt: new Date(entry.timeMs),
      },
    });
  }

  async update(patientId: string, id: string, entry: CarbInput): Promise<number> {
    const result = await this.prisma.carbEvent.updateMany({
      where: { id, patientId },
      data: {
        carbsGrams: entry.grams,
        description: entry.description,
        eventAt: new Date(entry.timeMs),
      },
    });
    return result.count;
  }

  async delete(patientId: string, id: string): Promise<number> {
    const result = await this.prisma.carbEvent.deleteMany({ where: { id, patientId } });
    return result.count;
  }

  async replaceAll(patientId: string, entries: readonly CarbCreate[]): Promise<void> {
    await this.prisma.carbEvent.deleteMany({ where: { patientId } });
    await this.prisma.carbEvent.createMany({
      data: entries.map((entry) => ({
        ...(entry.id ? { id: entry.id } : {}),
        patientId,
        carbsGrams: entry.grams,
        description: entry.description,
        eventAt: new Date(entry.timeMs),
      })),
    });
  }
}

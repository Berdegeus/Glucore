import type { InsulinEvent, PrismaClient } from '@prisma/client';

import type { InsulinInput } from './insulin.schema';

export type InsulinCreate = InsulinInput & { id?: string };

export interface IInsulinRepository {
  listRecent(patientId: string, limit: number): Promise<InsulinEvent[]>;
  create(patientId: string, entry: InsulinCreate): Promise<InsulinEvent>;
  /** Scoped by patient, so an id belonging to someone else updates nothing. */
  update(patientId: string, id: string, entry: InsulinInput): Promise<number>;
  delete(patientId: string, id: string): Promise<number>;
  replaceAll(patientId: string, entries: readonly InsulinCreate[]): Promise<void>;
}

/** The column is NOT NULL with an empty default; an absent day is stored as ''. */
const dayOfWeek = (value: string | undefined): string => value ?? '';

export class PrismaInsulinRepository implements IInsulinRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listRecent(patientId: string, limit: number): Promise<InsulinEvent[]> {
    return this.prisma.insulinEvent.findMany({
      where: { patientId },
      orderBy: { eventAt: 'desc' },
      take: limit,
    });
  }

  create(patientId: string, entry: InsulinCreate): Promise<InsulinEvent> {
    return this.prisma.insulinEvent.create({
      data: {
        ...(entry.id ? { id: entry.id } : {}),
        patientId,
        doseUnits: entry.units,
        insulinType: entry.type,
        eventAt: new Date(entry.timeMs),
        dayOfWeek: dayOfWeek(entry.dayOfWeek),
      },
    });
  }

  async update(patientId: string, id: string, entry: InsulinInput): Promise<number> {
    const result = await this.prisma.insulinEvent.updateMany({
      where: { id, patientId },
      data: {
        doseUnits: entry.units,
        insulinType: entry.type,
        eventAt: new Date(entry.timeMs),
        dayOfWeek: dayOfWeek(entry.dayOfWeek),
      },
    });
    return result.count;
  }

  async delete(patientId: string, id: string): Promise<number> {
    const result = await this.prisma.insulinEvent.deleteMany({ where: { id, patientId } });
    return result.count;
  }

  async replaceAll(patientId: string, entries: readonly InsulinCreate[]): Promise<void> {
    await this.prisma.insulinEvent.deleteMany({ where: { patientId } });
    await this.prisma.insulinEvent.createMany({
      data: entries.map((entry) => ({
        ...(entry.id ? { id: entry.id } : {}),
        patientId,
        doseUnits: entry.units,
        insulinType: entry.type,
        eventAt: new Date(entry.timeMs),
        dayOfWeek: dayOfWeek(entry.dayOfWeek),
      })),
    });
  }
}

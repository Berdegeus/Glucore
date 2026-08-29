/**
 * Data access for the insulin diary (`InsulinEvent`).
 *
 * Same shape as `carbRepository`: the Prisma client arrives by parameter
 * instead of being imported (design.md "Camadas do backend"), which is what
 * lets the route be tested without PostgreSQL. Mapping only — validation,
 * audit and truncation belong to the service.
 */

/** The narrow slice of `prisma.insulinEvent` this repository uses. */
export interface InsulinPrismaClient {
  insulinEvent: {
    findMany(args: {
      where: { patientId: string; eventAt?: { lt: Date } };
      orderBy: { eventAt: 'desc' };
      take: number;
    }): Promise<
      Array<{
        id: string;
        doseUnits: unknown;
        insulinType: string;
        eventAt: Date;
        dayOfWeek: string;
      }>
    >;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    updateMany(args: {
      where: { id: string; patientId: string };
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
    deleteMany(args: {
      where: { id?: string; patientId: string };
    }): Promise<{ count: number }>;
    createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  };
}

/** An insulin entry as the API exposes it. */
export interface InsulinEntry {
  id: string;
  units: number;
  type: string;
  timeMs: number;
  dayOfWeek: string;
}

export interface InsulinPageQuery {
  patientId: string;
  /** Exclusive upper bound, epoch ms. Absent means "from the newest". */
  before?: number;
  limit: number;
}

export interface InsulinInput {
  units: number;
  type: string;
  timeMs: number;
  dayOfWeek?: string;
}

export interface InsulinRepository {
  /** Newest first, strictly older than `before`, at most `limit` rows. */
  findPage(query: InsulinPageQuery): Promise<InsulinEntry[]>;
  /** Persists one entry, honouring a client-supplied UUID. Returns its id. */
  create(patientId: string, input: InsulinInput & { id?: string }): Promise<string>;
  /** Scoped to the patient; `false` means "no such row of yours". */
  update(id: string, patientId: string, input: InsulinInput): Promise<boolean>;
  /** Scoped to the patient; `false` means "no such row of yours". */
  remove(id: string, patientId: string): Promise<boolean>;
  /** Deprecated batch path: swaps the patient's whole collection. */
  replaceAll(patientId: string, entries: Array<InsulinInput & { id?: string }>): Promise<void>;
}

/** The column is `NOT NULL DEFAULT ''`; an absent day is stored as empty. */
const dayOf = (input: InsulinInput): string => input.dayOfWeek ?? '';

export function createInsulinRepository(client: InsulinPrismaClient): InsulinRepository {
  return {
    async findPage({ patientId, before, limit }) {
      const rows = await client.insulinEvent.findMany({
        where: {
          patientId,
          ...(before === undefined ? {} : { eventAt: { lt: new Date(before) } }),
        },
        orderBy: { eventAt: 'desc' },
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        units: Number(row.doseUnits),
        type: row.insulinType,
        timeMs: row.eventAt.getTime(),
        dayOfWeek: row.dayOfWeek,
      }));
    },

    async create(patientId, input) {
      const created = await client.insulinEvent.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          patientId,
          doseUnits: input.units,
          insulinType: input.type,
          eventAt: new Date(input.timeMs),
          dayOfWeek: dayOf(input),
        },
      });
      return created.id;
    },

    async update(id, patientId, input) {
      const result = await client.insulinEvent.updateMany({
        where: { id, patientId },
        data: {
          doseUnits: input.units,
          insulinType: input.type,
          eventAt: new Date(input.timeMs),
          dayOfWeek: dayOf(input),
        },
      });
      return result.count > 0;
    },

    async remove(id, patientId) {
      const result = await client.insulinEvent.deleteMany({ where: { id, patientId } });
      return result.count > 0;
    },

    async replaceAll(patientId, entries) {
      await client.insulinEvent.deleteMany({ where: { patientId } });
      await client.insulinEvent.createMany({
        data: entries.map((entry) => ({
          ...(entry.id ? { id: entry.id } : {}),
          patientId,
          doseUnits: entry.units,
          insulinType: entry.type,
          eventAt: new Date(entry.timeMs),
          dayOfWeek: dayOf(entry),
        })),
      });
    },
  };
}

/**
 * Data access for the carbohydrate diary (`CarbEvent`).
 *
 * The Prisma client is injected instead of imported (design.md "Camadas do
 * backend"), which is what makes the route testable without PostgreSQL: the
 * suite passes an in-memory double implementing `CarbPrismaClient`.
 *
 * The repository maps rows to the HTTP-facing shape and nothing else — no
 * validation, no audit, no truncation. Those belong to the service.
 */

/** The narrow slice of `prisma.carbEvent` this repository uses. */
export interface CarbPrismaClient {
  carbEvent: {
    findMany(args: {
      where: { patientId: string; eventAt?: { lt: Date } };
      orderBy: { eventAt: 'desc' };
      take: number;
    }): Promise<Array<{ id: string; carbsGrams: unknown; description: string; eventAt: Date }>>;
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

/** A carb entry as the API exposes it. */
export interface CarbEntry {
  id: string;
  grams: number;
  description: string;
  timeMs: number;
}

export interface CarbPageQuery {
  patientId: string;
  /** Exclusive upper bound, epoch ms. Absent means "from the newest". */
  before?: number;
  limit: number;
}

export interface CarbInput {
  grams: number;
  description: string;
  timeMs: number;
}

export interface CarbRepository {
  /** Newest first, strictly older than `before`, at most `limit` rows. */
  findPage(query: CarbPageQuery): Promise<CarbEntry[]>;
  /** Persists one entry, honouring a client-supplied UUID. Returns its id. */
  create(patientId: string, input: CarbInput & { id?: string }): Promise<string>;
  /** Scoped to the patient; `false` means "no such row of yours". */
  update(id: string, patientId: string, input: CarbInput): Promise<boolean>;
  /** Scoped to the patient; `false` means "no such row of yours". */
  remove(id: string, patientId: string): Promise<boolean>;
  /** Deprecated batch path: swaps the patient's whole collection. */
  replaceAll(patientId: string, entries: Array<CarbInput & { id?: string }>): Promise<void>;
}

export function createCarbRepository(client: CarbPrismaClient): CarbRepository {
  return {
    async findPage({ patientId, before, limit }) {
      const rows = await client.carbEvent.findMany({
        where: {
          patientId,
          ...(before === undefined ? {} : { eventAt: { lt: new Date(before) } }),
        },
        orderBy: { eventAt: 'desc' },
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        grams: Number(row.carbsGrams),
        description: row.description,
        timeMs: row.eventAt.getTime(),
      }));
    },

    async create(patientId, input) {
      const created = await client.carbEvent.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          patientId,
          carbsGrams: input.grams,
          description: input.description,
          eventAt: new Date(input.timeMs),
        },
      });
      return created.id;
    },

    async update(id, patientId, input) {
      const result = await client.carbEvent.updateMany({
        where: { id, patientId },
        data: {
          carbsGrams: input.grams,
          description: input.description,
          eventAt: new Date(input.timeMs),
        },
      });
      return result.count > 0;
    },

    async remove(id, patientId) {
      const result = await client.carbEvent.deleteMany({ where: { id, patientId } });
      return result.count > 0;
    },

    async replaceAll(patientId, entries) {
      await client.carbEvent.deleteMany({ where: { patientId } });
      await client.carbEvent.createMany({
        data: entries.map((entry) => ({
          ...(entry.id ? { id: entry.id } : {}),
          patientId,
          carbsGrams: entry.grams,
          description: entry.description,
          eventAt: new Date(entry.timeMs),
        })),
      });
    },
  };
}

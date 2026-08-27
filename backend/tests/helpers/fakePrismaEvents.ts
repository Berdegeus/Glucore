/**
 * In-memory double for a Prisma model delegate over a patient-scoped, time
 * ordered table (`CarbEvent`, `InsulinEvent`, `AlertEvent`).
 *
 * It is not a mock: it really filters by `patientId`, really applies the
 * `{ lt: Date }` cursor, really sorts by `orderBy` and really honours `take`.
 * A repository that forgets any of those loses data in a way the assertions
 * can see, which is the point — there is no PostgreSQL in this environment
 * (spec.md "Testes de rota sem Postgres").
 */

export interface FakeRow {
  id: string;
  patientId: string;
  [column: string]: unknown;
}

interface TimeFilter {
  lt?: Date;
}

interface FindManyArgs {
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
}

interface WriteArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
}

export interface FakeDelegate {
  findMany(args: FindManyArgs): Promise<FakeRow[]>;
  create(args: { data: Record<string, unknown> }): Promise<FakeRow>;
  updateMany(args: WriteArgs): Promise<{ count: number }>;
  deleteMany(args: WriteArgs): Promise<{ count: number }>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
}

export interface FakeTable {
  /** Live view of the stored rows, in insertion order. */
  rows: FakeRow[];
  delegate: FakeDelegate;
}

let generatedIds = 0;

function matches(row: FakeRow, where: Record<string, unknown> | undefined, timeField: string): boolean {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (key === timeField) {
      const filter = expected as TimeFilter;
      const at = row[timeField] as Date;
      if (filter?.lt !== undefined && !(at.getTime() < filter.lt.getTime())) return false;
      continue;
    }
    if (row[key] !== expected) return false;
  }
  return true;
}

/** Builds a delegate over `seed`, ordering and filtering on `timeField`. */
export function createFakeTable(seed: FakeRow[], timeField: string): FakeTable {
  const rows: FakeRow[] = seed.map((row) => ({ ...row }));

  const delegate: FakeDelegate = {
    async findMany(args) {
      let found = rows.filter((row) => matches(row, args.where, timeField));
      const direction = args.orderBy?.[timeField];
      if (direction === 'desc' || direction === 'asc') {
        const sign = direction === 'desc' ? -1 : 1;
        found = [...found].sort(
          (a, b) =>
            sign * ((a[timeField] as Date).getTime() - (b[timeField] as Date).getTime()),
        );
      }
      if (typeof args.take === 'number') found = found.slice(0, args.take);
      return found.map((row) => ({ ...row }));
    },

    async create(args) {
      generatedIds += 1;
      const row: FakeRow = {
        id: `generated-${generatedIds}`,
        patientId: '',
        ...args.data,
      } as FakeRow;
      rows.push(row);
      return { ...row };
    },

    async updateMany(args) {
      const target = rows.filter((row) => matches(row, args.where, timeField));
      for (const row of target) Object.assign(row, args.data as Record<string, unknown>);
      return { count: target.length };
    },

    async deleteMany(args) {
      const target = rows.filter((row) => matches(row, args.where, timeField));
      for (const row of target) rows.splice(rows.indexOf(row), 1);
      return { count: target.length };
    },

    async createMany(args) {
      for (const data of args.data) {
        generatedIds += 1;
        rows.push({ id: `generated-${generatedIds}`, patientId: '', ...data } as FakeRow);
      }
      return { count: args.data.length };
    },
  };

  return { rows, delegate };
}

/** A delegate whose every call rejects, for the error-propagation paths. */
export function createFailingTable(failure: Error): FakeDelegate {
  const reject = async (): Promise<never> => {
    throw failure;
  };
  return {
    findMany: reject,
    create: reject,
    updateMany: reject,
    deleteMany: reject,
    createMany: reject,
  };
}

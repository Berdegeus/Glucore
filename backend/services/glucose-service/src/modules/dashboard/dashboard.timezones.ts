import type { PrismaClient } from '@prisma/client';

/** Yields every zone name the database can resolve. Injected so unit tests never need Postgres. */
export type TimeZoneLoader = () => Promise<string[]>;

/** What the service needs to know about a `tz` — kept narrow so a fake is one method. */
export interface TimeZoneChecker {
  isValid(name: string): Promise<boolean>;
}

/**
 * Answers whether a name is a zone Postgres understands.
 *
 * The check has to be Postgres's, not a hand-kept list: `AT TIME ZONE` in the
 * dashboard queries is what ends up resolving the name, so "valid" must mean
 * exactly "that statement will not fail". `pg_timezone_names` is the catalogue
 * it resolves against. It is read once per process and then held in memory —
 * the set only changes with a server tzdata upgrade, and the validator runs on
 * every dashboard request.
 *
 * Matching is exact-case: the catalogue holds canonical names, and accepting
 * "america/sao_paulo" would make the same zone appear under many spellings.
 */
export class TimeZoneValidator implements TimeZoneChecker {
  private names: Promise<ReadonlySet<string>> | null = null;

  constructor(private readonly load: TimeZoneLoader) {}

  async isValid(name: string): Promise<boolean> {
    return (await this.loadedNames()).has(name);
  }

  /**
   * The in-flight promise is what gets cached, so concurrent first requests
   * share one query. A failed load is dropped instead of kept: a transient
   * database error must not turn into "every zone is invalid" until restart.
   */
  private loadedNames(): Promise<ReadonlySet<string>> {
    if (!this.names) {
      this.names = this.load()
        .then((list) => new Set(list))
        .catch((error: unknown) => {
          this.names = null;
          throw error;
        });
    }
    return this.names;
  }
}

export function prismaTimeZoneLoader(prisma: PrismaClient): TimeZoneLoader {
  return async () => {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM pg_timezone_names`;
    return rows.map((row) => row.name);
  };
}

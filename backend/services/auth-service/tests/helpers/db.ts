import { prisma } from '../../src/lib/prisma';

/**
 * Empties every application table between test cases.
 *
 * Read from the catalogue rather than hardcoded so a new model cannot silently
 * start leaking state across tests. `_prisma_migrations` is kept: dropping it
 * would make globalSetup re-run every migration on the next file.
 */
export async function truncateAll(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;

  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };

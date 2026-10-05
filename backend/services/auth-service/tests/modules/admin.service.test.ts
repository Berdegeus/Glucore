import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaAdminRepository } from '../../src/modules/admin/admin.repository';
import { parseUserListQuery } from '../../src/modules/admin/admin.schema';
import { AdminService } from '../../src/modules/admin/admin.service';
import { disconnect, prisma, truncateAll } from '../helpers/db';

/**
 * ADM-04 (searchable, filterable, paginated account list) and ADM-06 (every
 * list read is audited) against a real Postgres, through the real repository
 * and the real audit writer.
 */

const service = new AdminService(new PrismaAdminRepository(prisma));
const CONTEXT = { ipAddress: '10.0.0.7', userAgent: 'vitest' };

let adminId: string;

type Seed = {
  email: string;
  fullName: string;
  role?: 'PATIENT' | 'HEALTH_PROFESSIONAL' | 'ADMINISTRATOR';
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  createdAt?: string;
};

async function seed(rows: Seed[]): Promise<void> {
  await prisma.user.createMany({
    data: rows.map(({ createdAt, ...row }) => ({
      ...row,
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    })),
  });
}

const list = (query: Record<string, unknown> = {}) =>
  service.listUsers(adminId, parseUserListQuery(query), CONTEXT);

const emails = (page: { items: { email: string }[] }) => page.items.map((item) => item.email);

beforeEach(async () => {
  await truncateAll();
  adminId = (
    await prisma.user.create({
      data: { email: 'admin@example.com', fullName: 'Admin', role: 'ADMINISTRATOR' },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  await disconnect();
});

describe('AdminService.listUsers — filters', () => {
  beforeEach(async () => {
    await seed([
      { email: 'ana@example.com', fullName: 'Ana Souza' },
      { email: 'bia@example.com', fullName: 'Bia Souza', status: 'BLOCKED' },
      { email: 'carlos@clinic.com', fullName: 'Dr. Carlos', role: 'HEALTH_PROFESSIONAL' },
      {
        email: 'dora@clinic.com',
        fullName: 'Dra. Dora',
        role: 'HEALTH_PROFESSIONAL',
        status: 'INACTIVE',
      },
    ]);
  });

  it('filters by role', async () => {
    const page = await list({ role: 'HEALTH_PROFESSIONAL' });
    expect(emails(page).sort()).toEqual(['carlos@clinic.com', 'dora@clinic.com']);
    expect(page.total).toBe(2);
  });

  it('filters by status', async () => {
    expect(emails(await list({ status: 'BLOCKED' }))).toEqual(['bia@example.com']);
  });

  it('combines role, status and text with AND', async () => {
    expect(emails(await list({ role: 'HEALTH_PROFESSIONAL', status: 'INACTIVE' }))).toEqual([
      'dora@clinic.com',
    ]);
    expect(emails(await list({ role: 'PATIENT', status: 'ACTIVE', q: 'souza' }))).toEqual([
      'ana@example.com',
    ]);
    expect(await list({ role: 'ADMINISTRATOR', q: 'souza' })).toMatchObject({ items: [], total: 0 });
  });

  it('matches the text against the name or the email, ignoring case', async () => {
    expect(emails(await list({ q: 'SOUZA' })).sort()).toEqual(['ana@example.com', 'bia@example.com']);
    expect(emails(await list({ q: 'CLINIC.com' })).sort()).toEqual([
      'carlos@clinic.com',
      'dora@clinic.com',
    ]);
  });

  it('treats a blank q as no search', async () => {
    expect((await list({ q: '   ' })).total).toBe(5);
  });
});

describe('AdminService.listUsers — wildcards in the search text are literal', () => {
  beforeEach(async () => {
    await seed([
      { email: 'p1@example.com', fullName: 'Cem por cento 100%' },
      { email: 'p2@example.com', fullName: 'Cem por cento 100 reais' },
      { email: 'under_score@example.com', fullName: 'Sublinhado' },
      { email: 'underXscore@example.com', fullName: 'Outro' },
      { email: 'p3@example.com', fullName: String.raw`Barra \ invertida` },
    ]);
  });

  it('a literal % does not match everything', async () => {
    expect(emails(await list({ q: '%' }))).toEqual(['p1@example.com']);
    expect(emails(await list({ q: '100%' }))).toEqual(['p1@example.com']);
  });

  it('a literal _ does not match any single character', async () => {
    expect(emails(await list({ q: 'under_score' }))).toEqual(['under_score@example.com']);
  });

  it('a literal backslash is searchable', async () => {
    expect(emails(await list({ q: '\\' }))).toEqual(['p3@example.com']);
  });
});

describe('AdminService.listUsers — pages', () => {
  beforeEach(async () => {
    await seed(
      Array.from({ length: 30 }, (_, i) => ({
        email: `user${String(i).padStart(2, '0')}@example.com`,
        fullName: `Pessoa ${i}`,
        // user00 is the newest of the 30; all are older than the admin.
        createdAt: new Date(Date.UTC(2020, 0, 1) - i * 60_000).toISOString(),
      })),
    );
  });

  it('defaults to 25 per page, newest first, and reports the total', async () => {
    const page = await list();
    expect(page).toMatchObject({ page: 1, limit: 25, total: 31 });
    expect(page.items).toHaveLength(25);
    expect(page.items[0].email).toBe('admin@example.com');
    expect(page.items[1].email).toBe('user00@example.com');
  });

  it('serves the remainder on page 2 without overlapping page 1', async () => {
    const first = await list();
    const second = await list({ page: '2' });
    expect(second.items).toHaveLength(6);
    expect(second.items.at(-1)?.email).toBe('user29@example.com');
    const seen = new Set([...emails(first), ...emails(second)]);
    expect(seen.size).toBe(31);
  });

  it('breaks createdAt ties by id so the order is stable', async () => {
    await prisma.user.deleteMany({ where: { id: { not: adminId } } });
    const same = '2021-05-05T00:00:00.000Z';
    await seed(
      ['a', 'b', 'c', 'd'].map((letter) => ({ email: `${letter}@x.com`, fullName: letter, createdAt: same })),
    );
    // The admin is newer than the four tied accounts, so it leads; the ties follow by id.
    const tied = (await list()).items.slice(1).map((item) => item.id);
    expect(tied).toHaveLength(4);
    expect(tied).toEqual([...tied].sort());
  });

  it('returns an empty page past the end, still reporting the total', async () => {
    expect(await list({ page: '3' })).toMatchObject({ items: [], page: 3, total: 31 });
  });

  it('honours an explicit limit', async () => {
    expect((await list({ limit: '100' })).items).toHaveLength(31);
    expect((await list({ limit: '10' })).items).toHaveLength(10);
  });

  it('exposes only id, name, email, role, status and an ISO createdAt', async () => {
    const [item] = (await list({ q: 'user00' })).items;
    expect(Object.keys(item).sort()).toEqual(['createdAt', 'email', 'fullName', 'id', 'role', 'status']);
    expect(item.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(item).toMatchObject({ role: 'PATIENT', status: 'ACTIVE' });
  });
});

describe('AdminService.listUsers — audit', () => {
  it('records ADMIN_LIST_USERS for the admin with the filters and page, not the result', async () => {
    await seed([{ email: 'secret.patient@example.com', fullName: 'Paciente Sigiloso' }]);

    await list({ role: 'PATIENT', status: 'ACTIVE', q: 'sigiloso', page: '1', limit: '10' });

    const rows = await prisma.auditLog.findMany({ where: { action: 'ADMIN_LIST_USERS' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: adminId,
      entity: 'User',
      ipAddress: CONTEXT.ipAddress,
      userAgent: CONTEXT.userAgent,
      metadata: { role: 'PATIENT', status: 'ACTIVE', q: 'sigiloso', page: 1, limit: 10 },
    });
    const stored = JSON.stringify(rows[0].metadata);
    expect(stored).not.toContain('secret.patient@example.com');
    expect(stored).not.toContain('Paciente Sigiloso');
  });

  it('records an entry for every read, filters absent as null', async () => {
    await list();
    await list({ page: '2' });

    const rows = await prisma.auditLog.findMany({
      where: { action: 'ADMIN_LIST_USERS' },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((row) => row.metadata)).toEqual([
      { role: null, status: null, q: null, page: 1, limit: 25 },
      { role: null, status: null, q: null, page: 2, limit: 25 },
    ]);
  });
});

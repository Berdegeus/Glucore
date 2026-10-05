import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaPreferencesRepository } from '../../src/modules/preferences/preferences.repository';
import type { LayoutItem } from '../../src/modules/preferences/preferences.schema';
import { disconnect, prisma, truncateAll } from '../helpers/db';

/**
 * The layout table against a real Postgres: LAY-07/08 (save and load back),
 * LAY-09 (reset), LAY-14 (the account delete takes the layout with it).
 */

const repo = new PrismaPreferencesRepository(prisma);

let userId: string;
let otherUserId: string;

const createUser = async (email: string): Promise<string> =>
  (await prisma.user.create({ data: { email, fullName: 'Pessoa Teste' }, select: { id: true } }))
    .id;

beforeEach(async () => {
  await truncateAll();
  userId = await createUser('a@example.com');
  otherUserId = await createUser('b@example.com');
});

afterAll(async () => {
  await disconnect();
});

const LAYOUT: LayoutItem[] = [
  { id: 'kpi-tir', size: 'S' },
  { id: 'chart-agp', size: 'L' },
];

describe('PrismaPreferencesRepository', () => {
  it('find returns null when the user has no layout', async () => {
    expect(await repo.find(userId)).toBeNull();
  });

  it('upsert creates the row and find returns the same widgets, in order', async () => {
    expect(await repo.upsert(userId, LAYOUT)).toEqual(LAYOUT);
    expect(await repo.find(userId)).toEqual(LAYOUT);
    expect(await prisma.dashboardLayout.count()).toBe(1);
  });

  it('upsert replaces an existing layout instead of adding a second row', async () => {
    await repo.upsert(userId, LAYOUT);
    const next: LayoutItem[] = [{ id: 'kpi-gmi', size: 'M' }];

    expect(await repo.upsert(userId, next)).toEqual(next);
    expect(await repo.find(userId)).toEqual(next);
    expect(await prisma.dashboardLayout.count()).toBe(1);
  });

  it("keeps each user's layout apart", async () => {
    await repo.upsert(userId, LAYOUT);
    await repo.upsert(otherUserId, [{ id: 'kpi-cv', size: 'M' }]);

    expect(await repo.find(userId)).toEqual(LAYOUT);
    expect(await repo.find(otherUserId)).toEqual([{ id: 'kpi-cv', size: 'M' }]);
  });

  it('delete removes only that user layout', async () => {
    await repo.upsert(userId, LAYOUT);
    await repo.upsert(otherUserId, LAYOUT);

    await repo.delete(userId);

    expect(await repo.find(userId)).toBeNull();
    expect(await repo.find(otherUserId)).toEqual(LAYOUT);
  });

  it('delete is idempotent when there is no layout', async () => {
    await expect(repo.delete(userId)).resolves.toBeUndefined();
    await repo.upsert(userId, LAYOUT);
    await repo.delete(userId);
    await expect(repo.delete(userId)).resolves.toBeUndefined();
    expect(await repo.find(userId)).toBeNull();
  });

  it('deleting the user removes the layout (cascade)', async () => {
    await repo.upsert(userId, LAYOUT);

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.dashboardLayout.findUnique({ where: { userId } })).toBeNull();
    expect(await repo.find(userId)).toBeNull();
  });
});

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaAdminRepository } from '../../src/modules/admin/admin.repository';
import { disconnect, prisma, truncateAll } from '../helpers/db';

/**
 * ADM-01 / ADM-02 against a real Postgres: totals by role and status, and
 * sign-ups per UTC day with the empty days present as 0.
 */

const repo = new PrismaAdminRepository(prisma);

// Wednesday 2026-03-11, mid-day UTC. A 7-day period is 03-05 .. 03-11.
const NOW = new Date('2026-03-11T10:00:00.000Z');

type Fixture = {
  createdAt: string;
  role?: 'PATIENT' | 'HEALTH_PROFESSIONAL' | 'ADMINISTRATOR';
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
};

const FIXTURE: Fixture[] = [
  { createdAt: '2026-03-04T23:59:59.999Z' }, // last instant before the 7-day period
  { createdAt: '2026-03-05T00:00:00.000Z', role: 'HEALTH_PROFESSIONAL' }, // first instant of it
  { createdAt: '2026-03-05T08:00:00.000Z', status: 'INACTIVE' },
  { createdAt: '2026-03-08T12:00:00.000Z', role: 'ADMINISTRATOR' },
  { createdAt: '2026-03-11T00:00:00.000Z', status: 'BLOCKED' }, // start of today
  { createdAt: '2026-03-11T09:59:59.000Z' },
  { createdAt: '2026-02-10T12:00:00.000Z', role: 'HEALTH_PROFESSIONAL' }, // only in 30/90 days
];

beforeEach(async () => {
  await truncateAll();
  await prisma.user.createMany({
    data: FIXTURE.map((row, i) => ({
      email: `user${i}@example.com`,
      fullName: `Pessoa ${i}`,
      createdAt: new Date(row.createdAt),
      ...(row.role ? { role: row.role } : {}),
      ...(row.status ? { status: row.status } : {}),
    })),
  });
});

afterAll(async () => {
  await disconnect();
});

describe('PrismaAdminRepository.accountStats', () => {
  it('counts every account by role and by status, listing every enum value', async () => {
    const { accounts } = await repo.accountStats(7, NOW);

    expect(accounts.total).toBe(7);
    expect(accounts.byRole).toEqual([
      { role: 'PATIENT', count: 4 },
      { role: 'HEALTH_PROFESSIONAL', count: 2 },
      { role: 'ADMINISTRATOR', count: 1 },
    ]);
    expect(accounts.byStatus).toEqual([
      { status: 'ACTIVE', count: 5 },
      { status: 'INACTIVE', count: 1 },
      { status: 'BLOCKED', count: 1 },
    ]);
  });

  it('lists enum values nobody holds with a zero count', async () => {
    await truncateAll();
    await prisma.user.create({ data: { email: 'only@example.com', fullName: 'Unica Pessoa' } });

    const { accounts } = await repo.accountStats(7, NOW);

    expect(accounts.total).toBe(1);
    expect(accounts.byRole).toEqual([
      { role: 'PATIENT', count: 1 },
      { role: 'HEALTH_PROFESSIONAL', count: 0 },
      { role: 'ADMINISTRATOR', count: 0 },
    ]);
    expect(accounts.byStatus).toEqual([
      { status: 'ACTIVE', count: 1 },
      { status: 'INACTIVE', count: 0 },
      { status: 'BLOCKED', count: 0 },
    ]);
  });

  it('buckets sign-ups by UTC day and zero-fills the days without any, oldest first', async () => {
    const { registrationsByDay } = await repo.accountStats(7, NOW);

    expect(registrationsByDay).toEqual([
      { day: '2026-03-05', count: 2 },
      { day: '2026-03-06', count: 0 },
      { day: '2026-03-07', count: 0 },
      { day: '2026-03-08', count: 1 },
      { day: '2026-03-09', count: 0 },
      { day: '2026-03-10', count: 0 },
      { day: '2026-03-11', count: 2 },
    ]);
  });

  it('counts the sign-ups of the period, excluding the instant just before it', async () => {
    const stats = await repo.accountStats(7, NOW);

    expect(stats.registrationsInPeriod).toBe(5);
    expect(stats.registrationsInPeriod).toBe(
      stats.registrationsByDay.reduce((sum, row) => sum + row.count, 0),
    );
    // A 14-day period gains exactly the sign-up before the 7-day one; 30 days also reaches 02-10.
    expect((await repo.accountStats(14, NOW)).registrationsInPeriod).toBe(6);
  });

  it('returns exactly `days` buckets for 7, 30 and 90 days', async () => {
    for (const days of [7, 30, 90]) {
      const { registrationsByDay } = await repo.accountStats(days, NOW);
      expect(registrationsByDay).toHaveLength(days);
      expect(registrationsByDay.at(-1)?.day).toBe('2026-03-11');
    }
    expect((await repo.accountStats(90, NOW)).registrationsInPeriod).toBe(7);
  });

  it('reports an empty platform as all zeros with the full day range', async () => {
    await truncateAll();

    const stats = await repo.accountStats(7, NOW);

    expect(stats.accounts.total).toBe(0);
    expect(stats.registrationsInPeriod).toBe(0);
    expect(stats.registrationsByDay).toHaveLength(7);
    expect(stats.registrationsByDay.every((row) => row.count === 0)).toBe(true);
  });
});

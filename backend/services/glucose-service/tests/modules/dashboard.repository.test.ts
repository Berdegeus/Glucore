import { afterAll, describe, expect, it } from 'vitest';

import { PrismaDashboardRepository } from '../../src/modules/dashboard/dashboard.repository';
import { disconnect, prisma } from '../helpers/db';

/**
 * Integration tests for the repository methods that need a real Postgres:
 * time-zone arithmetic, `AT TIME ZONE` and the SQL functions. The route suite
 * covers the endpoint; this one pins each query on its own.
 */

const repository = new PrismaDashboardRepository(prisma);

afterAll(async () => {
  await disconnect();
});

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

describe('resolveBounds', () => {
  it('UTC gives midnight-to-midnight of the same dates, plus one day on the exclusive end', async () => {
    const bounds = await repository.resolveBounds(day('2026-08-01'), day('2026-08-14'), 'UTC');

    expect(bounds.from).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-08-15T00:00:00.000Z'));
  });

  it('America/Sao_Paulo starts at 03:00 UTC', async () => {
    const bounds = await repository.resolveBounds(day('2026-08-01'), day('2026-08-14'), 'America/Sao_Paulo');

    expect(bounds.from).toEqual(new Date('2026-08-01T03:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-08-15T03:00:00.000Z'));
  });

  it('a single day is 23 hours long when New York springs forward', async () => {
    const bounds = await repository.resolveBounds(day('2026-03-08'), day('2026-03-08'), 'America/New_York');

    expect(bounds.from).toEqual(new Date('2026-03-08T05:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-03-09T04:00:00.000Z'));
    expect(hoursBetween(bounds.from, bounds.toExclusive)).toBe(23);
  });

  it('a single day is 25 hours long when New York falls back', async () => {
    const bounds = await repository.resolveBounds(day('2026-11-01'), day('2026-11-01'), 'America/New_York');

    expect(bounds.from).toEqual(new Date('2026-11-01T04:00:00.000Z'));
    expect(bounds.toExclusive).toEqual(new Date('2026-11-02T05:00:00.000Z'));
    expect(hoursBetween(bounds.from, bounds.toExclusive)).toBe(25);
  });

  it('a period crossing the spring change is one hour short of whole days', async () => {
    const bounds = await repository.resolveBounds(day('2026-03-07'), day('2026-03-09'), 'America/New_York');

    expect(hoursBetween(bounds.from, bounds.toExclusive)).toBe(3 * 24 - 1);
  });
});

import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaAdminRepository } from '../../src/modules/admin/admin.repository';
import { disconnect, prisma, truncateAll } from '../helpers/db';

/**
 * ADM-01 / ADM-02 / ADM-03 against a real Postgres: platform counts that match
 * a known fixture, zero-filled days and weeks, and a response that carries
 * counts only.
 */

const repo = new PrismaAdminRepository(prisma);

// Wednesday 2026-03-11, mid-day UTC. A 7-day period is 03-05 .. 03-11 and
// overlaps the ISO weeks starting Monday 03-02 and 03-09.
const NOW = new Date('2026-03-11T10:00:00.000Z');

/** Distinctive on purpose: the privacy sweep looks for any of them in the response. */
const GLUCOSE_VALUES = [137, 211, 93, 168, 254, 71, 119];

const at = (iso: string) => new Date(iso);

const patientIds: string[] = [];

async function seedPatients(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => randomUUID());
  await prisma.patient.createMany({ data: ids.map((userId) => ({ userId })) });
  patientIds.push(...ids);
  return ids;
}

async function seedReadings(patientId: string, readings: [recordedAt: string, valueMgDl: number][]) {
  await prisma.glucoseReading.createMany({
    data: readings.map(([recordedAt, valueMgDl]) => ({ patientId, recordedAt: at(recordedAt), valueMgDl })),
  });
}

beforeEach(async () => {
  await truncateAll();
  patientIds.length = 0;
});

afterAll(async () => {
  await disconnect();
});

describe('PrismaAdminRepository.platformStats — patients and readings', () => {
  beforeEach(async () => {
    const [p1, p2, p3, , p5, p6] = await seedPatients(6); // the fourth never reads
    await seedReadings(p1, [
      ['2026-03-11T09:00:00.000Z', 137],
      ['2026-03-10T12:00:00.000Z', 211],
    ]);
    await seedReadings(p2, [
      ['2026-03-10T10:00:00.000Z', 93], // exactly 24 h before now
      ['2026-03-06T12:00:00.000Z', 168],
    ]);
    await seedReadings(p5, [['2026-03-10T09:59:59.999Z', 254]]); // 1 ms outside the 24 h window
    await seedReadings(p3, [['2026-03-04T10:00:00.000Z', 71]]); // exactly 7 d before now, before the period
    await seedReadings(p6, [['2026-03-04T09:59:59.999Z', 119]]); // 1 ms outside the 7 d window
  });

  it('counts the registered patients, with or without readings', async () => {
    expect((await repo.platformStats(7, NOW)).activePatients.registered).toBe(6);
  });

  it('counts distinct patients with a reading in the last 24 hours, boundary included', async () => {
    expect((await repo.platformStats(7, NOW)).activePatients.last24h).toBe(2);
  });

  it('counts distinct patients with a reading in the last 7 days, boundary included', async () => {
    expect((await repo.platformStats(7, NOW)).activePatients.last7d).toBe(4);
  });

  it('keeps the activity windows fixed whatever the period asked for', async () => {
    const stats = await repo.platformStats(90, NOW);
    expect(stats.activePatients).toEqual({ last24h: 2, last7d: 4, registered: 6 });
  });

  it('buckets readings by UTC day, zero-filling the empty days, oldest first', async () => {
    expect((await repo.platformStats(7, NOW)).readingsByDay).toEqual([
      { day: '2026-03-05', count: 0 },
      { day: '2026-03-06', count: 1 },
      { day: '2026-03-07', count: 0 },
      { day: '2026-03-08', count: 0 },
      { day: '2026-03-09', count: 0 },
      { day: '2026-03-10', count: 3 },
      { day: '2026-03-11', count: 1 },
    ]);
  });

  it('widens the readings range with the period', async () => {
    const { readingsByDay } = await repo.platformStats(30, NOW);
    expect(readingsByDay).toHaveLength(30);
    expect(readingsByDay.reduce((sum, row) => sum + row.count, 0)).toBe(7);
    expect(readingsByDay.find((row) => row.day === '2026-03-04')?.count).toBe(2);
  });
});

describe('PrismaAdminRepository.platformStats — grants', () => {
  beforeEach(async () => {
    // One patient per grant: a patient and a professional share at most one grant.
    const patients = await seedPatients(7);
    const professional = randomUUID();
    await prisma.healthProfessional.create({
      data: { userId: professional, licenseNumber: 'CRM-SP 1', specialty: 'Endocrinologia' },
    });

    const grant = (
      patientId: string,
      grantedAt: string,
      extra: { expiresAt?: string; revokedAt?: string } = {},
    ) =>
      prisma.dashboardAccessGrant.create({
        data: {
          patientId,
          healthProfessionalId: professional,
          permissionLevel: 'READ',
          grantedAt: at(grantedAt),
          ...(extra.expiresAt ? { expiresAt: at(extra.expiresAt) } : {}),
          ...(extra.revokedAt ? { revokedAt: at(extra.revokedAt) } : {}),
        },
      });

    await grant(patients[0], '2026-03-02T00:00:00.000Z'); // active, first Monday of the period's weeks
    await grant(patients[1], '2026-03-04T23:59:59.999Z'); // active, last instant of that week
    await grant(patients[2], '2026-03-10T08:00:00.000Z', { revokedAt: '2026-03-10T09:00:00.000Z' }); // revoked
    await grant(patients[3], '2026-03-09T00:00:00.000Z', { expiresAt: '2026-03-10T00:00:00.000Z' }); // expired
    await grant(patients[4], '2026-03-11T08:00:00.000Z', { expiresAt: '2026-03-20T00:00:00.000Z' }); // active, expires later
    await grant(patients[5], '2026-02-27T12:00:00.000Z'); // active, earlier week
    await grant(patients[6], '2026-03-01T12:00:00.000Z', { expiresAt: NOW.toISOString() }); // expires exactly now: not active
  });

  it('counts the grants neither revoked nor expired at now', async () => {
    expect((await repo.platformStats(7, NOW)).grants.active).toBe(4);
  });

  it('counts grants created per Monday-start week, for the weeks the period overlaps', async () => {
    expect((await repo.platformStats(7, NOW)).grants.createdByWeek).toEqual([
      { weekStart: '2026-03-02', count: 2 },
      { weekStart: '2026-03-09', count: 3 },
    ]);
  });

  it('zero-fills the weeks without a grant and reaches back with a longer period', async () => {
    const { createdByWeek } = (await repo.platformStats(30, NOW)).grants;
    expect(createdByWeek.map((week) => week.weekStart)).toEqual([
      '2026-02-09',
      '2026-02-16',
      '2026-02-23',
      '2026-03-02',
      '2026-03-09',
    ]);
    expect(createdByWeek.map((week) => week.count)).toEqual([0, 0, 2, 2, 3]);
  });
});

describe('PrismaAdminRepository.platformStats — alerts', () => {
  it('counts the alerts of the period by type and lists every type, zero included', async () => {
    const [patientId] = await seedPatients(1);
    const alert = (alertType: string, triggeredAt: string) => ({
      patientId,
      alertType: alertType as 'HYPO_RISK',
      triggeredAt: at(triggeredAt),
    });
    await prisma.alertEvent.createMany({
      data: [
        alert('HYPO_RISK', '2026-03-05T00:00:00.000Z'), // first instant of the period
        alert('HYPO_RISK', '2026-03-11T09:00:00.000Z'),
        alert('FAST_DROP', '2026-03-08T12:00:00.000Z'),
        alert('HYPER_RISK', '2026-03-04T23:59:59.999Z'), // 1 ms before the period
      ],
    });

    expect((await repo.platformStats(7, NOW)).alertsByType).toEqual([
      { alertType: 'HYPO_RISK', count: 2 },
      { alertType: 'HYPER_RISK', count: 0 },
      { alertType: 'FAST_DROP', count: 1 },
      { alertType: 'FAST_RISE', count: 0 },
      { alertType: 'SENSOR_RECONNECTED', count: 0 },
      { alertType: 'SYNC_FAILURE', count: 0 },
    ]);
    expect((await repo.platformStats(30, NOW)).alertsByType[1]).toEqual({ alertType: 'HYPER_RISK', count: 1 });
  });
});

describe('PrismaAdminRepository.platformStats — empty platform', () => {
  it('answers zeros with the full day, week and type ranges', async () => {
    const stats = await repo.platformStats(7, NOW);

    expect(stats.activePatients).toEqual({ last24h: 0, last7d: 0, registered: 0 });
    expect(stats.readingsByDay).toHaveLength(7);
    expect(stats.readingsByDay.every((row) => row.count === 0)).toBe(true);
    expect(stats.grants.active).toBe(0);
    expect(stats.grants.createdByWeek).toHaveLength(2);
    expect(stats.alertsByType).toHaveLength(6);
    expect(stats.alertsByType.every((row) => row.count === 0)).toBe(true);
  });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every key and every leaf value of a JSON-like tree. */
function sweep(node: unknown, keys: string[] = [], leaves: unknown[] = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => sweep(item, keys, leaves));
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      keys.push(key);
      sweep(value, keys, leaves);
    }
  } else {
    leaves.push(node);
  }
  return { keys, leaves };
}

describe('PrismaAdminRepository.platformStats — counts only (ADM-03)', () => {
  it('carries no identifier and no glucose value anywhere in the response', async () => {
    const [p1, p2] = await seedPatients(2);
    await seedReadings(p1, [
      ['2026-03-11T09:00:00.000Z', GLUCOSE_VALUES[0]],
      ['2026-03-11T08:00:00.000Z', GLUCOSE_VALUES[1]],
    ]);
    await seedReadings(p2, [['2026-03-10T12:00:00.000Z', GLUCOSE_VALUES[2]]]);
    const professional = randomUUID();
    await prisma.healthProfessional.create({
      data: { userId: professional, licenseNumber: 'CRM-SP 1', specialty: 'Endocrinologia' },
    });
    await prisma.dashboardAccessGrant.create({
      data: { patientId: p1, healthProfessionalId: professional, permissionLevel: 'READ', grantedAt: at('2026-03-10T00:00:00.000Z') },
    });
    await prisma.alertEvent.create({
      data: { patientId: p1, alertType: 'HYPO_RISK', triggeredAt: at('2026-03-11T09:00:00.000Z'), message: 'Glicose 137 mg/dL' },
    });

    const { keys, leaves } = sweep(await repo.platformStats(7, NOW));

    expect(new Set(keys)).toEqual(
      new Set([
        'activePatients',
        'last24h',
        'last7d',
        'registered',
        'readingsByDay',
        'day',
        'count',
        'grants',
        'active',
        'createdByWeek',
        'weekStart',
        'alertsByType',
        'alertType',
      ]),
    );
    expect(keys.filter((key) => /patientId|userId|healthProfessionalId/i.test(key))).toEqual([]);
    expect(leaves.filter((leaf) => typeof leaf === 'string' && UUID_RE.test(leaf))).toEqual([]);
    expect(leaves.filter((leaf) => typeof leaf === 'string' && leaf.includes('mg/dL'))).toEqual([]);
    expect(leaves.filter((leaf) => typeof leaf === 'number' && GLUCOSE_VALUES.includes(leaf))).toEqual([]);
    for (const id of [...patientIds, professional]) {
      expect(JSON.stringify(leaves)).not.toContain(id);
    }
  });
});

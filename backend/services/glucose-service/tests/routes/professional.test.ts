import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import {
  administratorToken,
  disconnect,
  prisma,
  signedInPatient,
  signedInProfessional,
  truncateAll,
  type SignedInPatient,
  type SignedInProfessional,
} from '../helpers/db';

/**
 * /professional end to end: the portfolio is limited to the token's active
 * grants (PRO-11), a patient without one is `NO_ACTIVE_GRANT` (PRO-12), every
 * read is audited without values (PRO-14), the list pages 50 by default and 200
 * at most (PRO-16), and only a health professional gets in (ACC-06).
 */

let app: Express;
let professional: SignedInProfessional;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  professional = await signedInProfessional();
});

afterAll(async () => {
  await disconnect();
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (path: string, token = professional.token) => request(app).get(path).set(bearer(token));

const HOUR = 3_600_000;
const FIVE_MIN = 5 * 60_000;

async function seedReadings(patientId: string, startMs: number, values: number[]): Promise<void> {
  await prisma.glucoseReading.createMany({
    data: values.map((valueMgDl, i) => ({ patientId, valueMgDl, recordedAt: new Date(startMs + i * FIVE_MIN) })),
  });
}

async function grant(
  patientId: string,
  professionalId = professional.userId,
  overrides: { revokedAt?: Date; grantedAt?: Date } = {},
): Promise<void> {
  await prisma.dashboardAccessGrant.create({
    data: { patientId, healthProfessionalId: professionalId, permissionLevel: 'READ', ...overrides },
  });
}

/** A patient with `values` as readings that ended about two hours ago. */
async function patientWithReadings(values: number[], startOffsetMs = 3 * HOUR): Promise<SignedInPatient> {
  const patient = await signedInPatient();
  await seedReadings(patient.userId, Date.now() - startOffsetMs, values);
  return patient;
}

const HYPO_15_MIN = [60, 60, 60, 60, 100];
const STEADY = [100, 100, 100, 100, 100];

describe('GET /professional/patients', () => {
  it('lists only the patients with an active grant of the token professional, with metrics and no name', async () => {
    const mine = await patientWithReadings(HYPO_15_MIN);
    const alsoMine = await patientWithReadings(STEADY);
    const revoked = await patientWithReadings(STEADY);
    const notMine = await patientWithReadings(STEADY);
    const other = await signedInProfessional();
    await grant(mine.userId, professional.userId, { grantedAt: new Date('2026-08-01T00:00:00.000Z') });
    await grant(alsoMine.userId, professional.userId, { grantedAt: new Date('2026-08-02T00:00:00.000Z') });
    await grant(revoked.userId, professional.userId, { revokedAt: new Date('2026-08-03T00:00:00.000Z') });
    await grant(notMine.userId, other.userId);

    const res = await get('/professional/patients');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 50, total: 2 });
    expect(res.body.items.map((item: { patientId: string }) => item.patientId)).toEqual([
      mine.userId,
      alsoMine.userId,
    ]);
    expect(res.body.items[0]).toEqual({
      patientId: mine.userId,
      lastReadingAt: expect.any(String),
      timeInRangePercent: 20,
      gmiPercent: expect.any(Number),
      cvPercent: expect.any(Number),
      sensorUsePercent: expect.any(Number),
      zoneDistribution: { veryLow: 0, low: 80, target: 20, high: 0, veryHigh: 0 },
      hypoEpisodes: 1,
      alertsCount: 0,
    });
    expect(res.body.items[1]).toMatchObject({ timeInRangePercent: 100, hypoEpisodes: 0 });

    const asOther = await get('/professional/patients', other.token);
    expect(asOther.body.items.map((item: { patientId: string }) => item.patientId)).toEqual([notMine.userId]);
  });

  it('answers an empty page for a professional with no grants', async () => {
    const res = await get('/professional/patients');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, limit: 50, total: 0 });
  });

  it('pages by page and limit with the total across pages', async () => {
    const patients = await Promise.all([1, 2, 3].map(() => signedInPatient()));
    for (const [i, patient] of patients.entries()) {
      await grant(patient.userId, professional.userId, { grantedAt: new Date(Date.UTC(2026, 7, 1 + i)) });
    }

    const second = await get('/professional/patients?page=2&limit=2');

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(second.body.items.map((item: { patientId: string }) => item.patientId)).toEqual([patients[2].userId]);
  });

  it.each([
    ['limit=1', 200],
    ['limit=200', 200],
    ['limit=201', 400],
    ['limit=0', 400],
    ['limit=abc', 400],
    ['page=1', 200],
    ['page=0', 400],
    ['page=-1', 400],
  ])('%s answers %i', async (query, status) => {
    const res = await get(`/professional/patients?${query}`);

    expect(res.status).toBe(status);
    if (status === 400) expect(res.body.code).toBe('INVALID_PAGINATION');
  });

  it.each([
    ['days=7', 200, undefined],
    ['days=14', 200, undefined],
    ['days=30', 200, undefined],
    ['days=90', 200, undefined],
    ['days=15', 400, 'INVALID_DASHBOARD_RANGE'],
    ['days=0', 400, 'INVALID_DASHBOARD_RANGE'],
    ['days=abc', 400, 'INVALID_DASHBOARD_RANGE'],
    ['tz=America/Sao_Paulo', 200, undefined],
    ['tz=Mars/Olympus', 400, 'INVALID_TIMEZONE'],
    ['tz=a%20b', 400, 'INVALID_TIMEZONE'],
  ])('%s answers %i %s', async (query, status, code) => {
    const res = await get(`/professional/patients?${query}`);

    expect(res.status).toBe(status);
    if (code) expect(res.body.code).toBe(code);
  });

  it('counts the alerts of the period and leaves older ones out', async () => {
    const patient = await patientWithReadings(STEADY);
    await grant(patient.userId);
    await prisma.alertEvent.createMany({
      data: [
        { patientId: patient.userId, alertType: 'HYPO_RISK', triggeredAt: new Date(Date.now() - HOUR) },
        { patientId: patient.userId, alertType: 'HYPER_RISK', triggeredAt: new Date(Date.now() - 2 * HOUR) },
        { patientId: patient.userId, alertType: 'HYPO_RISK', triggeredAt: new Date(Date.now() - 20 * 24 * HOUR) },
      ],
    });

    const within14 = await get('/professional/patients');
    const within30 = await get('/professional/patients?days=30');

    expect(within14.body.items[0].alertsCount).toBe(2);
    expect(within30.body.items[0].alertsCount).toBe(3);
  });
});

describe('GET /professional/patients/:id/summary', () => {
  const QUERY = 'from=2026-08-01&to=2026-08-14&tz=UTC';

  it('returns exactly the patient own summary for a patient with an active grant', async () => {
    const patient = await signedInPatient();
    await seedReadings(patient.userId, Date.parse('2026-08-05T08:00:00.000Z'), HYPO_15_MIN);
    await grant(patient.userId);

    const res = await get(`/professional/patients/${patient.userId}/summary?${QUERY}`);
    const own = await request(app).get(`/dashboard/summary?${QUERY}`).set(bearer(patient.token));

    expect(res.status).toBe(200);
    expect(own.status).toBe(200);
    expect(res.body).toEqual(own.body);
    expect(res.body.totals.readingsCount).toBe(5);
  });

  it('answers 403 NO_ACTIVE_GRANT for a patient the professional never had', async () => {
    const stranger = await signedInPatient();

    const res = await get(`/professional/patients/${stranger.userId}/summary?${QUERY}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'No active grant', code: 'NO_ACTIVE_GRANT' });
  });

  it('answers 403 NO_ACTIVE_GRANT right after the patient revokes, and for a grant of another professional', async () => {
    const patient = await signedInPatient();
    const other = await signedInProfessional();
    await grant(patient.userId, other.userId);
    await grant(patient.userId, professional.userId);
    expect((await get(`/professional/patients/${patient.userId}/summary?${QUERY}`)).status).toBe(200);

    await prisma.dashboardAccessGrant.updateMany({
      where: { patientId: patient.userId, healthProfessionalId: professional.userId },
      data: { revokedAt: new Date() },
    });

    const revoked = await get(`/professional/patients/${patient.userId}/summary?${QUERY}`);
    const stillOther = await get(`/professional/patients/${patient.userId}/summary?${QUERY}`, other.token);

    expect(revoked.status).toBe(403);
    expect(revoked.body.code).toBe('NO_ACTIVE_GRANT');
    expect(stillOther.status).toBe(200);
  });

  it('answers 400 for an id that is not a UUID, before any grant check', async () => {
    const res = await get(`/professional/patients/not-a-uuid/summary?${QUERY}`);

    expect(res.status).toBe(400);
  });

  it('answers 400 INVALID_DASHBOARD_RANGE for a bad range even with an active grant', async () => {
    const patient = await signedInPatient();
    await grant(patient.userId);

    const res = await get(`/professional/patients/${patient.userId}/summary?from=2026-08-14&to=2026-08-01`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DASHBOARD_RANGE');
  });
});

describe('GET /professional/cohort/summary', () => {
  it('aggregates only the active patients: KPIs, histogram, hypo by hour and per-patient zones', async () => {
    const hypoPatient = await patientWithReadings(HYPO_15_MIN);
    const steady = await patientWithReadings(STEADY);
    const silent = await signedInPatient();
    const revoked = await patientWithReadings(HYPO_15_MIN);
    const notMine = await patientWithReadings(HYPO_15_MIN);
    await grant(hypoPatient.userId);
    await grant(steady.userId);
    await grant(silent.userId);
    await grant(revoked.userId, professional.userId, { revokedAt: new Date('2026-08-03T00:00:00.000Z') });
    await grant(notMine.userId, (await signedInProfessional()).userId);

    const episodeStart = await prisma.glucoseReading.findFirstOrThrow({
      where: { patientId: hypoPatient.userId },
      orderBy: { recordedAt: 'asc' },
    });

    const res = await get('/professional/cohort/summary');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      patientCount: 3,
      avgTimeInRangePercent: 60,
      patientsWithHypo: 1,
      patientsStale: 1,
      tirHistogram: [
        { bucket: 'lt50', count: 1 },
        { bucket: '50to70', count: 0 },
        { bucket: 'gte70', count: 1 },
      ],
    });
    expect(res.body.avgGmiPercent).toEqual(expect.any(Number));
    expect(res.body.perPatient).toHaveLength(3);
    expect(res.body.perPatient.find((p: { patientId: string }) => p.patientId === silent.userId)).toEqual({
      patientId: silent.userId,
      timeInRangePercent: null,
      cvPercent: null,
      zoneDistribution: { veryLow: 0, low: 0, target: 0, high: 0, veryHigh: 0 },
    });
    expect(res.body.hypoByHour).toHaveLength(24);
    expect(res.body.hypoByHour.filter((entry: { count: number }) => entry.count > 0)).toEqual([
      { hour: episodeStart.recordedAt.getUTCHours(), count: 1 },
    ]);
  });

  it('answers 200 with zeros and full-shape charts for a professional with no grants', async () => {
    const res = await get('/professional/cohort/summary');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      patientCount: 0,
      avgTimeInRangePercent: null,
      avgGmiPercent: null,
      patientsWithHypo: 0,
      patientsStale: 0,
      perPatient: [],
    });
    expect(res.body.tirHistogram).toHaveLength(3);
    expect(res.body.hypoByHour).toHaveLength(24);
  });

  it.each([
    ['days=15', 'INVALID_DASHBOARD_RANGE'],
    ['tz=Mars/Olympus', 'INVALID_TIMEZONE'],
  ])('%s answers 400 %s', async (query, code) => {
    const res = await get(`/professional/cohort/summary?${query}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
  });
});

describe('access control', () => {
  const PATH_SEGMENTS = [
    '/professional/patients',
    '/professional/patients/00000000-0000-4000-8000-000000000001/summary',
    '/professional/cohort/summary',
  ];

  it.each(PATH_SEGMENTS)('%s answers 403 FORBIDDEN_ROLE to a patient and to an administrator (ACC-06)', async (path) => {
    const patient = await signedInPatient();

    for (const token of [patient.token, administratorToken()]) {
      const res = await get(path, token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
    }
  });

  it.each(PATH_SEGMENTS)('%s answers 401 without a token', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
  });
});

describe('audit trail (PRO-14)', () => {
  it('records the list, the cohort and the single-patient read with the professional and the route, never a value', async () => {
    const patient = await patientWithReadings(HYPO_15_MIN);
    await grant(patient.userId);

    await get('/professional/patients');
    await get('/professional/cohort/summary');
    await get(`/professional/patients/${patient.userId}/summary`);

    const rows = await prisma.auditLog.findMany({ where: { entity: 'PatientData' }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((row) => [row.userId, row.action, row.entityId, row.metadata])).toEqual([
      [professional.userId, 'READ_LIST', null, { route: '/professional/patients', patientCount: 1 }],
      [professional.userId, 'READ_COHORT', null, { route: '/professional/cohort/summary', patientCount: 1 }],
      [professional.userId, 'READ', patient.userId, { route: '/professional/patients/:id/summary' }],
    ]);
    // 60 and 100 are the glucose values seeded above.
    for (const row of rows) expect(JSON.stringify(row.metadata)).not.toMatch(/\b(60|100)\b|glucose|valueMgDl/i);
  });

  it('records nothing for a read that was refused', async () => {
    const stranger = await signedInPatient();

    const res = await get(`/professional/patients/${stranger.userId}/summary`);

    expect(res.status).toBe(403);
    expect(await prisma.auditLog.count({ where: { entity: 'PatientData' } })).toBe(0);
  });
});

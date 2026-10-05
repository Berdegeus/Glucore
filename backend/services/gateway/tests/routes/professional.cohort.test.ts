import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bearerFor } from '../helpers/gatewayApp';
import { JOAO, MARIA, startPortfolioHarness, type PortfolioHarness } from '../helpers/portfolioHarness';

/**
 * PRO-10 / PRO-15: the cohort aggregates, composed from glucose-service (the
 * numbers) and auth-service (the names of `perPatient`). Same degradation as
 * the patient list.
 */

const zones = { veryLow: 0, low: 3, target: 71.5, high: 20, veryHigh: 5.5 };

const COHORT = {
  patientCount: 2,
  avgTimeInRangePercent: 60,
  avgGmiPercent: 7.1,
  patientsWithHypo: 1,
  patientsStale: 0,
  perPatient: [
    { patientId: MARIA, timeInRangePercent: 71.5, cvPercent: 31, zoneDistribution: zones },
    { patientId: JOAO, timeInRangePercent: null, cvPercent: null, zoneDistribution: zones },
  ],
  tirHistogram: [
    { bucket: 'lt50', count: 0 },
    { bucket: '50to70', count: 1 },
    { bucket: 'gte70', count: 1 },
  ],
  hypoByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 3 ? 2 : 0 })),
};

let harness: PortfolioHarness;

const proBearer = bearerFor('pro-1', 'HEALTH_PROFESSIONAL');
const getCohort = (query = '') =>
  request(harness.app).get(`/api/v1/professional/cohort/summary${query}`).set('Authorization', proBearer);

beforeAll(async () => {
  harness = await startPortfolioHarness('/professional/cohort/summary', COHORT);
});

beforeEach(() => harness.reset());

afterAll(() => harness.close());

describe('GET /api/v1/professional/cohort/summary', () => {
  it('rejects a request with no token without calling glucose-service', async () => {
    const res = await request(harness.app).get('/api/v1/professional/cohort/summary');

    expect(res.status).toBe(401);
    expect(harness.glucoseFake.requests).toHaveLength(0);
  });

  it('adds names and initials to perPatient and leaves every aggregate as it came', async () => {
    const res = await getCohort();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBeUndefined();
    expect(res.body).toEqual({
      ...COHORT,
      perPatient: [
        { ...COHORT.perPatient[0], fullName: 'Maria da Silva', initials: 'MS' },
        { ...COHORT.perPatient[1], fullName: 'João', initials: 'JO' },
      ],
    });
  });

  it('asks glucose-service with the professional own token and query string, and auth-service for the patient ids', async () => {
    await getCohort('?days=30&tz=America%2FSao_Paulo');

    expect(harness.glucoseFake.requests[0].headers.authorization).toBe(proBearer);
    expect(harness.queries[0]).toEqual({ days: '30', tz: 'America/Sao_Paulo' });
    expect(harness.lookupCalls()[0].body).toEqual({ ids: [MARIA, JOAO] });
  });

  it('answers 200 with null names, initials from the id and X-Degraded when the names lookup fails', async () => {
    harness.lookup.fails = true;

    const res = await getCohort();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBe('patient-names');
    expect(res.body.perPatient.map((p: Record<string, unknown>) => [p.patientId, p.fullName, p.initials])).toEqual([
      [MARIA, null, 'P3F'],
      [JOAO, null, 'P4A'],
    ]);
    expect(res.body).toMatchObject({ patientCount: 2, avgTimeInRangePercent: 60, tirHistogram: COHORT.tirHistogram });
  });

  it('answers an empty cohort without asking auth-service', async () => {
    harness.glucose.body = { ...COHORT, patientCount: 0, perPatient: [] };

    const res = await getCohort();

    expect(res.status).toBe(200);
    expect(res.body.perPatient).toEqual([]);
    expect(harness.lookupCalls()).toHaveLength(0);
  });

  it.each([
    [403, { error: 'Forbidden', code: 'FORBIDDEN_ROLE' }],
    [400, { error: 'days must be one of 7, 14, 30, 90', code: 'INVALID_DASHBOARD_RANGE' }],
    [503, { error: 'boom', code: 'UPSTREAM_UNAVAILABLE' }],
  ])('propagates a %i %j from glucose-service, without calling auth-service', async (status, body) => {
    harness.glucose.status = status;
    harness.glucose.body = body;

    const res = await getCohort();

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(body.code);
    expect(harness.lookupCalls()).toHaveLength(0);
  });
});

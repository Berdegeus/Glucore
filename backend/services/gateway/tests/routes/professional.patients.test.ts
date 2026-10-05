import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bearerFor } from '../helpers/gatewayApp';
import { JOAO, MARIA, NO_ACCOUNT, startPortfolioHarness, type PortfolioHarness } from '../helpers/portfolioHarness';

/**
 * PRO-03 / PRO-15: the professional's list of patients, composed from
 * glucose-service (the metrics, no names) and auth-service (the names). The
 * names leg degrades to initials and `X-Degraded`; the metrics leg does not.
 */

const metrics = (patientId: string) => ({
  patientId,
  lastReadingAt: '2026-10-05T10:00:00.000Z',
  timeInRangePercent: 71.5,
  gmiPercent: 6.9,
  cvPercent: 31,
  sensorUsePercent: 88,
  zoneDistribution: { veryLow: 0, low: 3, target: 71.5, high: 20, veryHigh: 5.5 },
  hypoEpisodes: 2,
  alertsCount: 4,
});

const LIST = { items: [metrics(MARIA), metrics(JOAO)], page: 1, limit: 50, total: 2 };

let harness: PortfolioHarness;

const proBearer = bearerFor('pro-1', 'HEALTH_PROFESSIONAL');
const getList = (query = '') =>
  request(harness.app).get(`/api/v1/professional/patients${query}`).set('Authorization', proBearer);

beforeAll(async () => {
  harness = await startPortfolioHarness('/professional/patients', LIST);
});

beforeEach(() => harness.reset());

afterAll(() => harness.close());

describe('GET /api/v1/professional/patients', () => {
  it('rejects a request with no token without calling glucose-service', async () => {
    const res = await request(harness.app).get('/api/v1/professional/patients');

    expect(res.status).toBe(401);
    expect(harness.glucoseFake.requests).toHaveLength(0);
  });

  it('adds fullName and two-letter initials to every item and keeps the metrics and the paging as they came', async () => {
    const res = await getList();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBeUndefined();
    expect(res.body).toEqual({
      items: [
        { ...metrics(MARIA), fullName: 'Maria da Silva', initials: 'MS' },
        { ...metrics(JOAO), fullName: 'João', initials: 'JO' },
      ],
      page: 1,
      limit: 50,
      total: 2,
    });
  });

  it('asks glucose-service with the professional own token and query string, and auth-service for the patient ids', async () => {
    await getList('?days=7&page=2&limit=10&tz=America%2FSao_Paulo');

    expect(harness.glucoseFake.requests).toHaveLength(1);
    expect(harness.glucoseFake.requests[0].headers.authorization).toBe(proBearer);
    expect(harness.glucoseFake.requests[0].headers['x-internal-token']).toBeUndefined();
    expect(harness.queries[0]).toEqual({ days: '7', page: '2', limit: '10', tz: 'America/Sao_Paulo' });
    expect(harness.lookupCalls()).toHaveLength(1);
    expect(harness.lookupCalls()[0].body).toEqual({ ids: [MARIA, JOAO] });
  });

  it('answers 200 with fullName null, initials from the id and X-Degraded when the names lookup fails', async () => {
    harness.lookup.fails = true;

    const res = await getList();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBe('patient-names');
    expect(res.body.items.map((item: Record<string, unknown>) => [item.patientId, item.fullName, item.initials])).toEqual([
      [MARIA, null, 'P3F'],
      [JOAO, null, 'P4A'],
    ]);
    expect(res.body.items[0]).toMatchObject({ timeInRangePercent: 71.5, hypoEpisodes: 2 });
    expect(res.body).toMatchObject({ page: 1, limit: 50, total: 2 });
  });

  it('shows a null name and id initials, without degrading, for a patient whose account no longer exists', async () => {
    harness.glucose.body = { ...LIST, items: [metrics(NO_ACCOUNT)] };

    const res = await getList();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBeUndefined();
    expect(res.body.items[0]).toMatchObject({ fullName: null, initials: 'P9B' });
  });

  it('answers an empty page without asking auth-service', async () => {
    harness.glucose.body = { items: [], page: 1, limit: 50, total: 0 };

    const res = await getList();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, limit: 50, total: 0 });
    expect(harness.lookupCalls()).toHaveLength(0);
  });

  it.each([
    [403, { error: 'Forbidden', code: 'FORBIDDEN_ROLE' }],
    [403, { error: 'No active grant', code: 'NO_ACTIVE_GRANT' }],
    [400, { error: 'limit must be an integer between 1 and 200', code: 'INVALID_PAGINATION' }],
    [503, { error: 'boom', code: 'UPSTREAM_UNAVAILABLE' }],
  ])('propagates a %i %j from glucose-service, without calling auth-service', async (status, body) => {
    harness.glucose.status = status;
    harness.glucose.body = body;

    const res = await getList();

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(body.code);
    expect(harness.lookupCalls()).toHaveLength(0);
  });

  it('leaves the single-patient summary to the proxy', async () => {
    const res = await request(harness.app)
      .get('/api/v1/professional/patients/abc/summary')
      .set('Authorization', proBearer);

    expect(res.status).toBe(200);
    expect(harness.glucoseFake.requests.at(-1)).toMatchObject({ method: 'GET', path: '/professional/patients/abc/summary' });
    expect(harness.lookupCalls()).toHaveLength(0);
  });
});

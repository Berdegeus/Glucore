import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { server } from '../../../test/server';
import { summaryFixture } from '../../../test/summaryFakes';
import type { SummaryQuery } from '../domain/summary';
import { HttpSummaryRepository } from './httpSummaryRepository';

const OWN = `${API_BASE}/dashboard/summary`;
const PROFESSIONAL = `${API_BASE}/professional/patients/:id/summary`;
const QUERY: SummaryQuery = { range: { from: '2026-08-05', to: '2026-08-06' }, timeZone: 'America/Sao_Paulo' };

function setup(token: string | null = 'tok-1') {
  const { client } = createTestHttpClient(token);
  return new HttpSummaryRepository(client);
}

/** A copy of the fixture with the value at `keys` deleted, or replaced when `value` is given. */
function mutated(keys: (string | number)[], value?: unknown): unknown {
  const body = structuredClone(summaryFixture()) as unknown as Record<string | number, unknown>;
  let parent: Record<string | number, unknown> = body;
  for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string | number, unknown>;
  const last = keys[keys.length - 1] as string | number;
  if (value === undefined) delete parent[last];
  else parent[last] = value;
  return body;
}

afterEach(() => window.sessionStorage.clear());

describe('HttpSummaryRepository.load, own summary (PAC-01, ARQ-06)', () => {
  it('turns the complete answer into a GlucoseSummary', async () => {
    server.use(http.get(OWN, () => HttpResponse.json(summaryFixture())));

    expect(await setup().load(QUERY)).toEqual(summaryFixture());
  });

  it('keeps the nulls the API gives for a patient with no readings', async () => {
    const empty = summaryFixture({
      lastReadingAt: null,
      timeInRangePercent: null,
      gmiPercent: null,
      coefficientOfVariationPercent: null,
      byDay: [],
      agp: [],
      heatmap: [],
      excursions: [],
    });
    server.use(http.get(OWN, () => HttpResponse.json(empty)));

    expect(await setup().load(QUERY)).toEqual(empty);
  });

  it('sends from, to and the browser zone, always, with the bearer token (API-01)', async () => {
    let seen: { params: Record<string, string>; authorization: string | null } | undefined;
    server.use(
      http.get(OWN, ({ request }) => {
        seen = {
          params: Object.fromEntries(new URL(request.url).searchParams),
          authorization: request.headers.get('Authorization'),
        };
        return HttpResponse.json(summaryFixture());
      }),
    );

    await setup('tok-1').load(QUERY);

    expect(seen).toEqual({
      params: { from: '2026-08-05', to: '2026-08-06', tz: 'America/Sao_Paulo' },
      authorization: 'Bearer tok-1',
    });
  });
});

describe('HttpSummaryRepository.load, linked patient (PAC-01)', () => {
  it.each([
    ['p-1', 'p-1'],
    ['a/b', 'a%2Fb'],
  ])('reads patient %s from the professional route, with the same query', async (patientId, encoded) => {
    let seen: { path: string; params: Record<string, string> } | undefined;
    server.use(
      http.get(PROFESSIONAL, ({ request }) => {
        const url = new URL(request.url);
        seen = { path: url.pathname, params: Object.fromEntries(url.searchParams) };
        return HttpResponse.json(summaryFixture());
      }),
    );

    expect(await setup().load({ ...QUERY, patientId })).toEqual(summaryFixture());

    expect(seen).toEqual({
      path: `/api/v1/professional/patients/${encoded}/summary`,
      params: { from: '2026-08-05', to: '2026-08-06', tz: 'America/Sao_Paulo' },
    });
  });

  it('turns 403 NO_ACTIVE_GRANT into forbidden, keeping the code', async () => {
    server.use(http.get(PROFESSIONAL, () => HttpResponse.json({ error: 'No grant', code: 'NO_ACTIVE_GRANT' }, { status: 403 })));

    expect(await rejectionOf(setup().load({ ...QUERY, patientId: 'p-1' }))).toMatchObject({
      kind: 'forbidden',
      code: 'NO_ACTIVE_GRANT',
    });
  });
});

describe('HttpSummaryRepository.load, a broken contract (ARQ-07)', () => {
  it.each<[string, (string | number)[], unknown?]>([
    ['tz', ['tz']],
    ['lastReadingAt', ['lastReadingAt']],
    ['totals.alertsCount', ['totals', 'alertsCount']],
    ['gmiPercent', ['gmiPercent']],
    ['sensorUsePercent', ['sensorUsePercent']],
    ['zoneDistribution', ['zoneDistribution']],
    ['zoneDistribution.veryHigh', ['zoneDistribution', 'veryHigh']],
    ['byDay', ['byDay']],
    ['byDay[0].carbsGrams', ['byDay', 0, 'carbsGrams']],
    ['byDay[0].insulinUnits', ['byDay', 0, 'insulinUnits']],
    ['byDay[0].readingsCount as text', ['byDay', 0, 'readingsCount'], '15'],
    ['agp', ['agp']],
    ['agp[0].p95', ['agp', 0, 'p95']],
    ['heatmap', ['heatmap']],
    ['heatmap[0].count', ['heatmap', 0, 'count']],
    ['excursions[0].kind outside HYPO and HYPER', ['excursions', 0, 'kind'], 'OTHER'],
  ])('turns a missing or wrong %s into unknown, naming the endpoint', async (_label, keys, value) => {
    server.use(http.get(OWN, () => HttpResponse.json(mutated(keys, value) as object)));

    const error = await rejectionOf(setup().load(QUERY));

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain('GET /dashboard/summary');
  });

  it('turns a body that is not JSON into unknown', async () => {
    server.use(http.get(OWN, () => new HttpResponse('<html>bad gateway</html>', { status: 200 })));

    expect(await rejectionOf(setup().load(QUERY))).toMatchObject({ kind: 'unknown' });
  });

  it('names the professional endpoint without the patient id', async () => {
    server.use(http.get(PROFESSIONAL, () => HttpResponse.json({})));

    const error = await rejectionOf(setup().load({ ...QUERY, patientId: 'secret-id' }));

    expect((error as Error).message).toContain('GET /professional/patients/:id/summary');
    expect((error as Error).message).not.toContain('secret-id');
  });
});

describe('HttpSummaryRepository.load, errors of the API', () => {
  it.each([
    ['INVALID_DASHBOARD_RANGE', 'validation'],
    ['INVALID_TIMEZONE', 'validation'],
  ])('turns 400 %s into a %s error that carries the code', async (code, kind) => {
    server.use(http.get(OWN, () => HttpResponse.json({ error: 'bad', code }, { status: 400 })));

    expect(await rejectionOf(setup().load(QUERY))).toMatchObject({ kind, code });
  });

  it('turns 503 into unavailable', async () => {
    server.use(http.get(OWN, () => HttpResponse.json({ error: 'down' }, { status: 503 })));

    expect(await rejectionOf(setup().load(QUERY))).toMatchObject({ kind: 'unavailable' });
  });
});

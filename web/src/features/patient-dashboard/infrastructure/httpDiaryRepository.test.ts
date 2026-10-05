import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { server } from '../../../test/server';
import type { CarbEntry, DiaryRepository, InsulinEntry, Reading } from '../domain/diary';
import { HttpDiaryRepository } from './httpDiaryRepository';

const READING = { value: 142, timestampMs: 1_786_000_000_000, trend: 'FLAT', rate: 0.5, alarmCode: null };
const CARB = { id: 'c-1', grams: 45.5, description: 'Pão', timeMs: 1_786_000_100_000 };
const INSULIN = { id: 'i-1', units: 4, type: 'RAPID', timeMs: 1_786_000_200_000, dayOfWeek: 'WEDNESDAY' };

interface Resource {
  name: string;
  path: string;
  /** What the endpoint answers for one record. */
  dto: Record<string, unknown>;
  /** The domain entity that record becomes. */
  entity: Reading | CarbEntry | InsulinEntry;
  list: (repository: DiaryRepository) => Promise<unknown>;
}

const RESOURCES: Resource[] = [
  { name: 'readings', path: '/readings', dto: READING, entity: READING, list: (r) => r.listReadings() },
  { name: 'carbs', path: '/carbs', dto: CARB, entity: CARB, list: (r) => r.listCarbs() },
  { name: 'insulin', path: '/insulin', dto: INSULIN, entity: INSULIN, list: (r) => r.listInsulin() },
];

function setup(token: string | null = 'tok-1'): DiaryRepository {
  return new HttpDiaryRepository(createTestHttpClient(token).client);
}

afterEach(() => window.sessionStorage.clear());

describe.each(RESOURCES)('HttpDiaryRepository, $name (PAC-11, ARQ-06)', ({ path, dto, entity, list }) => {
  const url = `${API_BASE}${path}`;

  it('turns every record into a domain entity, in the order the API gives', async () => {
    const second = { ...dto, ...(path === '/readings' ? { timestampMs: 5 } : { id: 'other' }) };
    server.use(http.get(url, () => HttpResponse.json([dto, second])));

    const result = (await list(setup())) as unknown[];

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(entity);
    expect(result[1]).toEqual(second);
  });

  it('answers an empty list for a patient with nothing recorded', async () => {
    server.use(http.get(url, () => HttpResponse.json([])));

    expect(await list(setup())).toEqual([]);
  });

  it('only ever reads: one GET with the bearer token', async () => {
    const seen: { method: string; authorization: string | null }[] = [];
    server.use(
      http.all(url, ({ request }) => {
        seen.push({ method: request.method, authorization: request.headers.get('Authorization') });
        return HttpResponse.json([]);
      }),
    );

    await list(setup('tok-1'));

    expect(seen).toEqual([{ method: 'GET', authorization: 'Bearer tok-1' }]);
  });

  it.each([
    ['a body that is not a list', { items: [] }],
    ['a record with a field of the wrong type', [{ ...dto, [Object.keys(dto)[0] as string]: { nested: true } }]],
    ['a record missing a field', [Object.fromEntries(Object.entries(dto).slice(1))]],
  ])('fails as unknown, naming the endpoint and not the values, on %s', async (_label, body) => {
    server.use(http.get(url, () => HttpResponse.json(body)));

    const error = await rejectionOf(list(setup()));

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain(`GET ${path}`);
    expect((error as Error).message).not.toContain('Pão');
  });

  it.each([
    [403, 'forbidden'],
    [503, 'unavailable'],
  ])('maps a %i answer to the %s error', async (status, kind) => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'x' }, { status })));

    expect(await rejectionOf(list(setup()))).toMatchObject({ kind });
  });
});

describe('HttpDiaryRepository, page size (PAC-11)', () => {
  it.each([
    ['/carbs', (r: DiaryRepository) => r.listCarbs()],
    ['/insulin', (r: DiaryRepository) => r.listInsulin()],
  ])('asks %s for 500 entries, the most one page gives, not the default 100', async (path, list) => {
    let limit: string | null = null;
    server.use(
      http.get(`${API_BASE}${path}`, ({ request }) => {
        limit = new URL(request.url).searchParams.get('limit');
        return HttpResponse.json([]);
      }),
    );

    await list(setup());

    expect(limit).toBe('500');
  });

  it('asks /readings for no page: the API gives its newest 5000', async () => {
    let search: string | null = null;
    server.use(
      http.get(`${API_BASE}/readings`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
    );

    await setup().listReadings();

    expect(search).toBe('');
  });
});

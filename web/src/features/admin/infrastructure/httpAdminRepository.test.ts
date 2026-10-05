import { http, HttpResponse, type JsonBodyType } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { accountPageDto, accountRowDto, overviewDto, overviewOf } from '../../../test/adminFakes';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { itMapsForbidden, itRejectsMalformed, type MalformedCase, type RepositoryCall } from '../../../test/repositoryErrors';
import { server } from '../../../test/server';
import type { AdminRepository } from '../domain/overview';
import { HttpAdminRepository } from './httpAdminRepository';

const OVERVIEW = `${API_BASE}/admin/overview`;
const USERS = `${API_BASE}/admin/users`;

type Call = (repository: AdminRepository) => Promise<unknown>;
const overview: Call = (repository) => repository.overview(30);
const users: Call = (repository) => repository.users({ page: 1, limit: 25 });

function setup(token: string | null = 'tok-1'): AdminRepository {
  return new HttpAdminRepository(createTestHttpClient(token).client);
}

/** Answers `body` on `url` and records the query string and the bearer of the request. */
function capture(url: string, body: JsonBodyType) {
  const seen: { params?: Record<string, string>; authorization?: string | null } = {};
  server.use(
    http.get(url, ({ request }) => {
      seen.params = Object.fromEntries(new URL(request.url).searchParams);
      seen.authorization = request.headers.get('Authorization');
      return HttpResponse.json(body);
    }),
  );
  return seen;
}

const CALLS: RepositoryCall<AdminRepository>[] = [
  ['overview', OVERVIEW, overview],
  ['users', USERS, users],
];

afterEach(() => window.sessionStorage.clear());

describe('HttpAdminRepository.overview (ADM-01, ADM-07)', () => {
  it.each([7, 30, 90] as const)('asks for %i days with the bearer token and turns the answer into an AdminOverview', async (days) => {
    const seen = capture(OVERVIEW, overviewDto());

    expect(await setup().overview(days)).toEqual(overviewOf());
    expect(seen).toEqual({ params: { days: String(days) }, authorization: 'Bearer tok-1' });
  });

  it('keeps zero counts, and drops fields the contract does not have', async () => {
    const zeros = overviewDto({ registrationsInPeriod: 0, activePatients: { last24h: 0, last7d: 0, registered: 0, extra: 'x' }, leaked: 'x' });
    capture(OVERVIEW, zeros);

    const result = await setup().overview(7);

    expect(result.registrationsInPeriod).toBe(0);
    expect(result.activePatients).toEqual({ last24h: 0, last7d: 0, registered: 0 });
    expect(result).not.toHaveProperty('leaked');
  });
});

describe('HttpAdminRepository.users (ADM-04)', () => {
  it('turns the page into account rows and reads the paging', async () => {
    capture(USERS, { ...accountPageDto([accountRowDto(), accountRowDto({ id: 'u2', role: 'HEALTH_PROFESSIONAL', status: 'BLOCKED' })]), total: 60 });

    const page = await setup().users({ page: 1, limit: 25 });

    expect(page.items.map((row) => [row.id, row.role, row.status])).toEqual([
      ['u1', 'PATIENT', 'ACTIVE'],
      ['u2', 'HEALTH_PROFESSIONAL', 'BLOCKED'],
    ]);
    expect(page.items[0]).toEqual(accountRowDto());
    expect([page.page, page.limit, page.total]).toEqual([1, 25, 60]);
  });

  it('sends role, status, the trimmed search, page and limit', async () => {
    const seen = capture(USERS, accountPageDto([]));

    await setup().users({ role: 'ADMINISTRATOR', status: 'INACTIVE', q: '  ana  ', page: 3, limit: 50 });

    expect(seen.params).toEqual({ role: 'ADMINISTRATOR', status: 'INACTIVE', q: 'ana', page: '3', limit: '50' });
  });

  it.each([undefined, '', '   '])('leaves out the filters not chosen and a search of %j', async (q) => {
    const seen = capture(USERS, accountPageDto([]));

    await setup().users({ q, page: 1, limit: 25 });

    expect(seen.params).toEqual({ page: '1', limit: '25' });
  });
});

describe('HttpAdminRepository errors (ADM-05, ARQ-06)', () => {
  itMapsForbidden(CALLS, setup, 'FORBIDDEN_ROLE');

  it.each(CALLS)('%s: 503 becomes unavailable', async (_name, url, call) => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'Down', code: 'SERVICE_UNAVAILABLE' }, { status: 503 })));

    expect(await rejectionOf(call(setup()))).toMatchObject({ kind: 'unavailable' });
  });

  const MALFORMED: MalformedCase<AdminRepository>[] = [
    ['overview, a missing grants block', OVERVIEW, overviewDto({ grants: undefined }), overview],
    ['overview, an unknown role in the split', OVERVIEW, overviewDto({ accounts: { total: 1, byRole: [{ role: 'ROOT', count: 1 }], byStatus: [] } }), overview],
    ['overview, a negative count', OVERVIEW, overviewDto({ registrationsInPeriod: -1 }), overview],
    ['users, a row with an unknown status', USERS, accountPageDto([accountRowDto({ status: 'GONE' })]), users],
    ['users, items that is not a list', USERS, { items: 'nope' }, users],
  ];

  itRejectsMalformed(MALFORMED, setup, 'ana@example.com');
});

import { http, HttpResponse } from 'msw';
import type { Role } from '../shared/domain/role';
import type { GlucoseSummary } from '../features/patient-dashboard/domain/summary';
import { accountOf } from './authFakes';
import { API_BASE } from './httpClient';
import { server } from './server';
import { summaryFixture } from './summaryFakes';

export interface ApiMockOptions {
  /** What `GET /dashboard/summary` answers; a function sees the request count, for a second answer after "Atualizar". */
  summary?: GlucoseSummary | ((request: number) => GlucoseSummary);
  /** The saved layout; `null` is a person with none (the default applies). */
  layout?: { id: string; size: 'S' | 'M' | 'L' }[] | null;
  /** The role `/me` gives; `null` leaves `/me` unanswered, as no token would. */
  role?: Role | null;
  /** The token `POST /auth/login` hands back. */
  token?: string;
}

export interface ApiMock {
  /** Every `GET /dashboard/summary` received, in order. */
  summaryRequests: URL[];
  /** Every `GET /readings` received: the diary reloads as one with its carbohydrate and insulin. */
  readingsRequests: URL[];
}

/** The gateway as the web sees it, over MSW. Anything not named here fails the test as unhandled (setup.ts). */
export function mockApi({ summary = summaryFixture(), layout = null, role = 'PATIENT', token = 'token-1' }: ApiMockOptions = {}): ApiMock {
  const mock: ApiMock = { summaryRequests: [], readingsRequests: [] };
  server.use(
    http.get(`${API_BASE}/dashboard/summary`, ({ request }) => {
      mock.summaryRequests.push(new URL(request.url));
      return HttpResponse.json(typeof summary === 'function' ? summary(mock.summaryRequests.length) : summary);
    }),
    http.get(`${API_BASE}/preferences/dashboard`, () => HttpResponse.json({ widgets: layout })),
    http.get(`${API_BASE}/readings`, ({ request }) => {
      mock.readingsRequests.push(new URL(request.url));
      return HttpResponse.json([]);
    }),
    http.get(`${API_BASE}/carbs`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/insulin`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/auth/login`, () => HttpResponse.json({ token })),
  );
  if (role !== null) server.use(http.get(`${API_BASE}/me`, () => HttpResponse.json(accountOf(role))));
  return mock;
}

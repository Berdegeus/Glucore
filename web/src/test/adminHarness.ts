import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { createContainer } from '../composition/container';
import { AdminServicesProvider } from '../features/admin';
import { accountPageDto, overviewDto } from './adminFakes';
import { API_BASE } from './httpClient';
import { TEST_API_URL } from './pageHarness';
import { plainQueryClient } from './professionalHarness';
import { server } from './server';

/** The wrapper for the admin hooks: the real container's use cases over MSW and a query client that does not retry. */
export function adminWrapper(client: QueryClient = plainQueryClient()) {
  const services = createContainer({ apiUrl: TEST_API_URL }).useCases.admin;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client, children: createElement(AdminServicesProvider, { services, children }) });
  return { wrapper, client };
}

interface AdminMock {
  /** Every `GET /admin/overview` received, in order. */
  overviewRequests: URL[];
  /** Every `GET /admin/users` received, in order. */
  usersRequests: URL[];
}

interface AdminAnswers {
  /** The answer to the n-th overview request (1 for the first); the fixture when omitted. */
  overview?: (request: number) => Response;
  /** The answer to the n-th users request; one account when omitted. */
  users?: (request: number) => Response;
}

/** The admin endpoints of the gateway over MSW, counting the requests. Pair it with `adminWrapper()`. */
export function mockAdmin({ overview, users }: AdminAnswers = {}): AdminMock {
  const mock: AdminMock = { overviewRequests: [], usersRequests: [] };
  server.use(
    http.get(`${API_BASE}/admin/overview`, ({ request }) => {
      mock.overviewRequests.push(new URL(request.url));
      return overview ? overview(mock.overviewRequests.length) : HttpResponse.json(overviewDto());
    }),
    http.get(`${API_BASE}/admin/users`, ({ request }) => {
      mock.usersRequests.push(new URL(request.url));
      return users ? users(mock.usersRequests.length) : HttpResponse.json(accountPageDto());
    }),
  );
  return mock;
}

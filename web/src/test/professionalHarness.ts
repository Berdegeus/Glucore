import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { createContainer } from '../composition/container';
import { ProfessionalServicesProvider } from '../features/professional';
import { RevokedAccessProvider } from '../features/professional/presentation/revokedAccess';
import { API_BASE } from './httpClient';
import { TEST_API_URL } from './pageHarness';
import { cohortDto, patientPageDto, patientRowDto } from './professionalFakes';
import { server } from './server';
import { summaryFixture } from './summaryFakes';

/** A query client that does not retry, so a failure shows at once. */
export const plainQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * The wrapper for the professional hooks: the real container's use cases over
 * MSW, a query client and the revoked-access provider the pages put above them.
 */
export function professionalWrapper(client: QueryClient = plainQueryClient()) {
  const services = createContainer({ apiUrl: TEST_API_URL }).useCases.professional;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, {
      client,
      children: createElement(ProfessionalServicesProvider, {
        services,
        children: createElement(RevokedAccessProvider, { children }),
      }),
    });
  return { wrapper, client };
}

interface PortfolioMock {
  /** Every `GET /professional/patients` received, in order. */
  listRequests: URL[];
  /** Every `GET /professional/cohort/summary` received, in order. */
  cohortRequests: URL[];
}

interface PortfolioAnswers {
  /** The answer to the n-th list request (1 for the first); the default is two patients, then, after a revocation, just the second. */
  list?: (request: number) => Response;
  cohort?: (request: number) => Response;
}

export const TWO_PATIENTS = [patientRowDto(), patientRowDto({ patientId: 'p2', fullName: 'Bia Lima', initials: 'BL' })];

/** The portfolio endpoints of the gateway over MSW. Pair it with `professionalWrapper()`. */
export function mockPortfolio({ list, cohort }: PortfolioAnswers = {}): PortfolioMock {
  const mock: PortfolioMock = { listRequests: [], cohortRequests: [] };
  server.use(
    http.get(`${API_BASE}/professional/patients`, ({ request }) => {
      mock.listRequests.push(new URL(request.url));
      return list ? list(mock.listRequests.length) : HttpResponse.json(patientPageDto(TWO_PATIENTS));
    }),
    http.get(`${API_BASE}/professional/cohort/summary`, ({ request }) => {
      mock.cohortRequests.push(new URL(request.url));
      return cohort ? cohort(mock.cohortRequests.length) : HttpResponse.json(cohortDto());
    }),
  );
  return mock;
}

interface LinkedPatientMock {
  /** Every `GET /professional/patients/:id/summary` received, in order. */
  requests: URL[];
}

/**
 * `GET /professional/patients/:id/summary` over MSW, for any patient: the fixture summary, or whatever
 * `answer` returns for the n-th request (1 for the first), e.g. a `403 NO_ACTIVE_GRANT`.
 */
export function mockLinkedPatientSummary(answer?: (request: number) => Response): LinkedPatientMock {
  const mock: LinkedPatientMock = { requests: [] };
  server.use(
    http.get(`${API_BASE}/professional/patients/:id/summary`, ({ request }) => {
      mock.requests.push(new URL(request.url));
      return answer ? answer(mock.requests.length) : HttpResponse.json(summaryFixture());
    }),
  );
  return mock;
}

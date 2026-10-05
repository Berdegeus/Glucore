import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ServiceProviders } from '../app/serviceProviders';
import { createContainer } from '../composition/container';
import { RevokedAccessProvider } from '../features/professional/presentation/revokedAccess';
import { TEST_API_URL, testQueryClient } from './pageHarness';

interface ProfessionalPageOptions {
  /** The route `page` sits on; the portfolio by default. */
  path?: string;
  /** Where the router starts; `path` by default. */
  initialEntry?: string;
  /** Other pages the router can reach, by path, for a redirect to land on. */
  routes?: Readonly<Record<string, ReactElement>>;
  /** A client to start from, e.g. with a list already cached. */
  client?: QueryClient;
}

/** Where the router is, as text; read it with `screen.getByTestId(LOCATION_TEST_ID)`. */
export const LOCATION_TEST_ID = 'location';

function LocationProbe() {
  const { pathname } = useLocation();
  return <p data-testid={LOCATION_TEST_ID}>{pathname}</p>;
}

/**
 * Mounts `page` the way the routes do: on the real container over MSW, under the
 * revoked-access notice both pages of the professional share, inside a router with
 * the registered widgets. Pair it with `mockPortfolio()` and `mockLayoutStore()`.
 */
export function renderProfessionalPage(
  page: ReactElement,
  { path = '/profissional', initialEntry = path, routes = {}, client = testQueryClient() }: ProfessionalPageOptions = {},
) {
  const container = createContainer({ apiUrl: TEST_API_URL });
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <ServiceProviders container={container}>
          <RevokedAccessProvider>
            <Routes>
              <Route path={path} element={page} />
              {Object.entries(routes).map(([routePath, element]) => (
                <Route key={routePath} path={routePath} element={element} />
              ))}
            </Routes>
            <LocationProbe />
          </RevokedAccessProvider>
        </ServiceProviders>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...view, appContainer: container, client };
}

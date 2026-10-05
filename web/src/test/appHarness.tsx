import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { AppProviders } from '../app/appProviders';
import { AppRoutes } from '../app/routes';
import { createContainer } from '../composition/container';
import { TEST_API_URL } from './pageHarness';

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

/** The path and query the app is on, read from the marker `renderApp` mounts. */
export const where = () => screen.getByTestId('where').textContent;

interface AppOptions {
  /** A token already in the tab's session storage, as after a reload; without one nobody is signed in. */
  token?: string;
}

/**
 * Mounts the whole app, providers and routes, on the real container over MSW,
 * starting at `route`. Pair it with `mockApi()`.
 */
export function renderApp(route: string, { token }: AppOptions = {}) {
  const container = createContainer({ apiUrl: TEST_API_URL });
  if (token) container.tokenStore.save(token);
  else container.tokenStore.clear();
  const view = render(
    <AppProviders container={container}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
        <Where />
      </MemoryRouter>
    </AppProviders>,
  );
  return { ...view, appContainer: container };
}

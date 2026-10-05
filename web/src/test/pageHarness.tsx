import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ServiceProviders } from '../app/serviceProviders';
import { createContainer } from '../composition/container';

/** The host `API_BASE` of `test/httpClient.ts` is mounted on. */
export const TEST_API_URL = 'http://api.test';

/** A fresh query client that does not retry, so a failure shows at once. */
export const testQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Mounts `page` on the real container over MSW, with no sign-in in the way: the
 * use cases, the HTTP client and the registered widgets are the app's own.
 * Pair it with `mockApi()`.
 */
export function renderOnContainer(page: ReactElement) {
  const container = createContainer({ apiUrl: TEST_API_URL });
  const client = testQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ServiceProviders container={container}>{page}</ServiceProviders>
    </QueryClientProvider>,
  );
  return { ...view, appContainer: container, client };
}

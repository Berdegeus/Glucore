import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AuthProvider, type AuthServices } from '../features/auth/presentation/authProvider';
import { makeAuthServices } from './authServices';

interface Options {
  services?: AuthServices;
  /** Where the memory router starts. */
  route?: string;
  queryClient?: QueryClient;
}

/** Mounts `ui` under a query client, the real `AuthProvider` and a memory router. */
export function renderWithAuth(ui: ReactNode, options: Options = {}) {
  const { services = makeAuthServices().services, route = '/', queryClient = new QueryClient() } = options;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider services={services}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...view, services, queryClient };
}

import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import type { Container } from '../composition/container';
import { AuthProvider, type AuthServices } from '../features/auth';
import { createQueryClient } from '../shared/presentation/queryClient';
import { ThemeProvider } from '../shared/presentation/theme/themeProvider';
import { ServiceProviders } from './serviceProviders';

/**
 * Everything the pages read from context, built from the container: the theme,
 * the one query cache (`logout` clears it), the signed-in person and the use
 * cases of the widgets (ARQ-08). The router goes inside, so a test can pick its own.
 */
export function AppProviders({ container, children }: { container: Container; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const authServices = useMemo<AuthServices>(
    () => ({
      ...container.useCases.auth,
      sessionEvents: container.sessionEvents,
      registerSessionCleaner: container.registerSessionCleaner,
    }),
    [container],
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider services={authServices}>
          <ServiceProviders container={container}>{children}</ServiceProviders>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

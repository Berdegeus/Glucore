import { createContext, useContext, type ReactNode } from 'react';
import type { LayoutUseCases } from '../application/layoutUseCases';

const LayoutServicesContext = createContext<LayoutUseCases | null>(null);

/**
 * Hands the layout use cases to the hooks and the editor below it. The app
 * passes `container.useCases.layout`; a test passes use cases over fakes. The
 * presentation layer never builds them itself (ARQ-03).
 */
export function LayoutServicesProvider({ services, children }: { services: LayoutUseCases; children: ReactNode }) {
  return <LayoutServicesContext.Provider value={services}>{children}</LayoutServicesContext.Provider>;
}

export function useLayoutServices(): LayoutUseCases {
  const services = useContext(LayoutServicesContext);
  if (!services) throw new Error('useLayoutServices needs a LayoutServicesProvider above it');
  return services;
}

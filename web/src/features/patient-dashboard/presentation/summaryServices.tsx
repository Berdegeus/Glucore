import { createContext, useContext, type ReactNode } from 'react';
import type { SummaryUseCases } from '../application/loadPatientSummary';

const SummaryServicesContext = createContext<SummaryUseCases | null>(null);

/**
 * Hands the summary use cases to the hooks and widgets below it. The app
 * passes `container.useCases.summary`; a test passes use cases over fakes. The
 * presentation layer never builds them itself (ARQ-03).
 */
export function SummaryServicesProvider({ services, children }: { services: SummaryUseCases; children: ReactNode }) {
  return <SummaryServicesContext.Provider value={services}>{children}</SummaryServicesContext.Provider>;
}

export function useSummaryServices(): SummaryUseCases {
  const services = useContext(SummaryServicesContext);
  if (!services) throw new Error('useSummaryServices needs a SummaryServicesProvider above it');
  return services;
}

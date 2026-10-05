import { createContext, useContext, type ReactNode } from 'react';
import type { ProfessionalUseCases } from '../application/professionalUseCases';

const ProfessionalServicesContext = createContext<ProfessionalUseCases | null>(null);

/**
 * Hands the professional use cases to the hooks and widgets below it. The app
 * passes `container.useCases.professional`; a test passes use cases over
 * fakes. The presentation layer never builds them itself (ARQ-03).
 */
export function ProfessionalServicesProvider({ services, children }: { services: ProfessionalUseCases; children: ReactNode }) {
  return <ProfessionalServicesContext.Provider value={services}>{children}</ProfessionalServicesContext.Provider>;
}

export function useProfessionalServices(): ProfessionalUseCases {
  const services = useContext(ProfessionalServicesContext);
  if (!services) throw new Error('useProfessionalServices needs a ProfessionalServicesProvider above it');
  return services;
}

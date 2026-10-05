import { createContext, useContext, type ReactNode } from 'react';
import type { RegistrationUseCases } from '../application/registerProfessional';

const RegistrationServicesContext = createContext<RegistrationUseCases | null>(null);

/**
 * Hands the registration use case to the page below it. The app passes
 * `container.useCases.registration`; a test passes one over fakes. The
 * presentation layer never builds it itself (ARQ-03).
 */
export function RegistrationServicesProvider({ services, children }: { services: RegistrationUseCases; children: ReactNode }) {
  return <RegistrationServicesContext.Provider value={services}>{children}</RegistrationServicesContext.Provider>;
}

export function useRegistrationServices(): RegistrationUseCases {
  const services = useContext(RegistrationServicesContext);
  if (!services) throw new Error('useRegistrationServices needs a RegistrationServicesProvider above it');
  return services;
}

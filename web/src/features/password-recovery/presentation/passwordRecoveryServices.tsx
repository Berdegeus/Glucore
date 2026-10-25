import { createContext, useContext, type ReactNode } from 'react';
import type { PasswordRecoveryUseCases } from '../application/passwordRecoveryUseCases';

const PasswordRecoveryServicesContext = createContext<PasswordRecoveryUseCases | null>(null);

/** Hands the recovery use cases to the pages below it; the app passes `container.useCases.passwordRecovery` (ARQ-03). */
export function PasswordRecoveryServicesProvider({ services, children }: { services: PasswordRecoveryUseCases; children: ReactNode }) {
  return <PasswordRecoveryServicesContext.Provider value={services}>{children}</PasswordRecoveryServicesContext.Provider>;
}

export function usePasswordRecoveryServices(): PasswordRecoveryUseCases {
  const services = useContext(PasswordRecoveryServicesContext);
  if (!services) throw new Error('usePasswordRecoveryServices needs a PasswordRecoveryServicesProvider above it');
  return services;
}

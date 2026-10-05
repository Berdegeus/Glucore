import { createContext, useContext, type ReactNode } from 'react';
import type { AdminUseCases } from '../application/adminUseCases';

const AdminServicesContext = createContext<AdminUseCases | null>(null);

/**
 * Hands the administrator's use cases to the hooks and widgets below it. The
 * app passes `container.useCases.admin`; a test passes use cases over fakes.
 * The presentation layer never builds them itself (ARQ-03).
 */
export function AdminServicesProvider({ services, children }: { services: AdminUseCases; children: ReactNode }) {
  return <AdminServicesContext.Provider value={services}>{children}</AdminServicesContext.Provider>;
}

export function useAdminServices(): AdminUseCases {
  const services = useContext(AdminServicesContext);
  if (!services) throw new Error('useAdminServices needs an AdminServicesProvider above it');
  return services;
}

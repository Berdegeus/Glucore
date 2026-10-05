import { createContext, useContext, type ReactNode } from 'react';

const AdminPeriodContext = createContext<number | null>(null);

/**
 * The period, in days, the administrator's widgets show. A widget receives
 * only its `size`, so the page puts the period filter's choice (7, 30 or 90)
 * here and every widget reads it with `useAdminDays`; all of them then share
 * the one overview query of that period (ADM-07).
 */
export function AdminPeriodProvider({ days, children }: { days: number; children: ReactNode }) {
  return <AdminPeriodContext.Provider value={days}>{children}</AdminPeriodContext.Provider>;
}

export function useAdminDays(): number {
  const days = useContext(AdminPeriodContext);
  if (days === null) throw new Error('useAdminDays needs an AdminPeriodProvider above it');
  return days;
}

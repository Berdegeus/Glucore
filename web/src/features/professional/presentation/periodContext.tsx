import { createContext, useContext, type ReactNode } from 'react';

const PeriodContext = createContext<number | null>(null);

/**
 * The period, in days, the widgets below show. A widget receives only its
 * `size`, so the page puts the period filter's choice (7, 14, 30 or 90) here
 * and every widget reads it with `usePeriodDays`; all of them then ask the same
 * cohort and list queries (PRO-05).
 */
export function ProfessionalPeriodProvider({ days, children }: { days: number; children: ReactNode }) {
  return <PeriodContext.Provider value={days}>{children}</PeriodContext.Provider>;
}

export function usePeriodDays(): number {
  const days = useContext(PeriodContext);
  if (days === null) throw new Error('usePeriodDays needs a ProfessionalPeriodProvider above it');
  return days;
}

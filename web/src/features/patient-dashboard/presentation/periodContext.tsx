import { createContext, useContext, type ReactNode } from 'react';
import type { DateRange } from '../domain/period';

const PeriodContext = createContext<DateRange | null>(null);

/**
 * The period the widgets below show. A widget receives only its `size`, so the
 * page puts the period filter's choice here and every widget reads it with
 * `usePeriod`; all of them then ask the same summary (PAC-17).
 */
export function PeriodProvider({ range, children }: { range: DateRange; children: ReactNode }) {
  return <PeriodContext.Provider value={range}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): DateRange {
  const range = useContext(PeriodContext);
  if (!range) throw new Error('usePeriod needs a PeriodProvider above it');
  return range;
}

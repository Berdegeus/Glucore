import { createContext, useContext, type ReactNode } from 'react';
import type { DiaryUseCases } from '../application/loadDayDetail';

const DiaryServicesContext = createContext<DiaryUseCases | null>(null);

/**
 * Hands the diary use cases to the widgets below it. The app passes
 * `container.useCases.patientDiary`; a test passes use cases over fakes. The
 * presentation layer never builds them itself (ARQ-03).
 */
export function DiaryServicesProvider({ services, children }: { services: DiaryUseCases; children: ReactNode }) {
  return <DiaryServicesContext.Provider value={services}>{children}</DiaryServicesContext.Provider>;
}

export function useDiaryServices(): DiaryUseCases {
  const services = useContext(DiaryServicesContext);
  if (!services) throw new Error('useDiaryServices needs a DiaryServicesProvider above it');
  return services;
}

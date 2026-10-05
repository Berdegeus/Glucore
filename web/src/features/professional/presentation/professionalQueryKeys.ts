import { browserTimeZone } from '../../../shared/presentation/browserTimeZone';

/** Every query of the professional's portfolio starts with this, so one call can reach them all. */
export const PROFESSIONAL_KEY = ['professional'] as const;
export const PATIENTS_KEY = [...PROFESSIONAL_KEY, 'patients'] as const;
export const COHORT_KEY = [...PROFESSIONAL_KEY, 'cohort'] as const;

/** One cache entry per period, page, page size and zone: a change of any of them is a new request (PRO-05). */
export const patientsQueryKey = (days: number, page: number, limit: number) =>
  [...PATIENTS_KEY, days, page, limit, browserTimeZone()] as const;

export const cohortQueryKey = (days: number) => [...COHORT_KEY, days, browserTimeZone()] as const;

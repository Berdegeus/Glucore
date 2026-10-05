import { useQueryClient } from '@tanstack/react-query';
import type { PatientPage } from '../domain/cohort';
import { PATIENTS_KEY } from './professionalQueryKeys';

/** How many characters of the id stand in for the initials when no cached list names the patient. */
const ID_INITIALS = 2;

/**
 * What to call a linked patient on the detail page: the name the portfolio list
 * already holds, read from the cache with no request of its own, else "Paciente"
 * and the first letters of the id (PRO-15).
 */
export function usePatientName(patientId: string): string {
  const client = useQueryClient();
  const pages = client.getQueriesData<PatientPage>({ queryKey: PATIENTS_KEY });
  for (const [, page] of pages) {
    const row = page?.items.find((item) => item.patientId === patientId);
    if (row) return row.displayName;
  }
  return `Paciente ${patientId.slice(0, ID_INITIALS).toUpperCase()}`;
}

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { isAppError } from '../../../shared/domain/appError';
import type { PatientPage } from '../domain/cohort';
import { PATIENTS_KEY, PROFESSIONAL_KEY } from './professionalQueryKeys';

export const REVOKED_ACCESS_MESSAGE = 'O paciente revogou o acesso';

/** The `code` of the `403` the API answers once a patient has ended the link. */
export const NO_ACTIVE_GRANT_CODE = 'NO_ACTIVE_GRANT';

/** `true` for the `403 NO_ACTIVE_GRANT` of a link the patient revoked (PRO-13); any other failure is not. */
export function isAccessRevoked(error: unknown): boolean {
  return isAppError(error) && error.kind === 'forbidden' && error.code === NO_ACTIVE_GRANT_CODE;
}

export interface RevokedAccess {
  /** The notice the page shows, or `null` while nothing was revoked. */
  notice: string | null;
  /**
   * Call it with the error of any professional call. A revoked link is dealt
   * with (the patient leaves the cached list, the notice is set and the
   * queries that can reload do) and `true` comes back; any other error
   * comes back `false`, untouched. Pass `patientId` when the call was about one patient.
   */
  handleError(error: unknown, patientId?: string): boolean;
  dismiss(): void;
}

const RevokedAccessContext = createContext<RevokedAccess | null>(null);

function withoutPatient(page: PatientPage, patientId: string): PatientPage {
  const items = page.items.filter((row) => row.patientId !== patientId);
  return { ...page, items, total: Math.max(0, page.total - (page.items.length - items.length)) };
}

/**
 * Holds the "patient revoked access" notice and the reaction to it (PRO-13), for
 * the portfolio page and the patient detail alike. The patient leaves every
 * cached list at once; the lists and the cohort then reload, so the counts and
 * charts agree with the links that are still active. A query that failed is
 * left alone: reloading it would only fail again, and again.
 */
export function RevokedAccessProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const handleError = useCallback(
    (error: unknown, patientId?: string) => {
      if (!isAccessRevoked(error)) return false;
      if (patientId !== undefined) {
        client.setQueriesData<PatientPage>({ queryKey: PATIENTS_KEY }, (page) => page && withoutPatient(page, patientId));
      }
      setNotice(REVOKED_ACCESS_MESSAGE);
      void client.invalidateQueries({ queryKey: PROFESSIONAL_KEY, predicate: (query) => query.state.status !== 'error' });
      return true;
    },
    [client],
  );

  const dismiss = useCallback(() => setNotice(null), []);
  const value = useMemo(() => ({ notice, handleError, dismiss }), [notice, handleError, dismiss]);
  return <RevokedAccessContext.Provider value={value}>{children}</RevokedAccessContext.Provider>;
}

export function useRevokedAccessNotice(): RevokedAccess {
  const value = useContext(RevokedAccessContext);
  if (!value) throw new Error('useRevokedAccessNotice needs a RevokedAccessProvider above it');
  return value;
}

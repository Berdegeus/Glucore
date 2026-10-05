import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { REFETCH_INTERVAL_MS } from '../../../shared/presentation/queryClient';
import { cohortDto, patientPageDto, patientRowDto } from '../../../test/professionalFakes';
import { mockPortfolio, professionalWrapper, TWO_PATIENTS } from '../../../test/professionalHarness';
import type { PatientPage } from '../domain/cohort';
import { cohortQueryKey, patientsQueryKey } from './professionalQueryKeys';
import { useProfessionalServices } from './professionalServices';
import { REVOKED_ACCESS_MESSAGE, useRevokedAccessNotice } from './revokedAccess';
import { useCohort } from './useCohort';
import { usePatients } from './usePatients';

const revoked = () => HttpResponse.json({ error: 'No active grant', code: 'NO_ACTIVE_GRANT' }, { status: 403 });
const wrongRole = () => HttpResponse.json({ error: 'Wrong role', code: 'FORBIDDEN_ROLE' }, { status: 403 });
const ids = (page: PatientPage | undefined) => page?.items.map((row) => row.patientId);

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

/** Both queries of the portfolio and the notice, as the page below the providers reads them. */
function mountPortfolio(days: number) {
  const { wrapper, client } = professionalWrapper();
  const view = renderHook(
    // Spread: TanStack Query re-renders only for the fields read while rendering, and the test reads them afterwards.
    ({ period }) => ({ patients: { ...usePatients(period) }, cohort: { ...useCohort(period) }, revoked: useRevokedAccessNotice() }),
    { wrapper, initialProps: { period: days } },
  );
  const loaded = () => waitFor(() => expect(view.result.current.patients.isSuccess && view.result.current.cohort.isSuccess).toBe(true));
  return { ...view, client, loaded };
}

describe('usePatients and useCohort (PRO-05)', () => {
  it('load the patients and the cohort of the period, in the browser zone', async () => {
    const mock = mockPortfolio();
    const { result, loaded } = mountPortfolio(14);

    await loaded();

    expect(ids(result.current.patients.data)).toEqual(['p1', 'p2']);
    expect(result.current.cohort.data?.patientCount).toBe(2);
    const [list] = mock.listRequests;
    const [cohort] = mock.cohortRequests;
    expect(Object.fromEntries(list?.searchParams ?? [])).toMatchObject({ days: '14', page: '1', limit: '50' });
    expect(list?.searchParams.get('tz')).toBeTruthy();
    expect(Object.fromEntries(cohort?.searchParams ?? [])).toMatchObject({ days: '14' });
    expect(cohort?.searchParams.get('tz')).toBeTruthy();
  });

  it('request both again when the period changes, and only then', async () => {
    const mock = mockPortfolio();
    const { rerender, loaded, result } = mountPortfolio(14);
    await loaded();
    expect([mock.listRequests.length, mock.cohortRequests.length]).toEqual([1, 1]);

    rerender({ period: 14 });
    rerender({ period: 30 });

    await waitFor(() => expect([mock.listRequests.length, mock.cohortRequests.length]).toEqual([2, 2]));
    expect(mock.listRequests[1]?.searchParams.get('days')).toBe('30');
    expect(mock.cohortRequests[1]?.searchParams.get('days')).toBe('30');
    await waitFor(() => expect(result.current.patients.isSuccess && result.current.cohort.isSuccess).toBe(true));
  });

  it('keep an entry per period, page, page size and zone in their keys', () => {
    expect(patientsQueryKey(14, 1, 50)).not.toEqual(patientsQueryKey(30, 1, 50));
    expect(patientsQueryKey(14, 1, 50)).not.toEqual(patientsQueryKey(14, 2, 50));
    expect(patientsQueryKey(14, 1, 50)).not.toEqual(patientsQueryKey(14, 1, 10));
    expect(cohortQueryKey(14)).not.toEqual(cohortQueryKey(90));
    expect(patientsQueryKey(14, 1, 50)).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(cohortQueryKey(14)).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('share one cohort request between widgets that ask for the same period', async () => {
    const mock = mockPortfolio();
    const { wrapper } = professionalWrapper();
    const { result } = renderHook(() => ({ first: useCohort(7), second: useCohort(7) }), { wrapper });

    await waitFor(() => expect(result.current.first.isSuccess && result.current.second.isSuccess).toBe(true));

    expect(mock.cohortRequests).toHaveLength(1);
  });

  it('fail clearly when no services or revoked-access provider is above them', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useRevokedAccessNotice())).toThrow('RevokedAccessProvider');
    expect(() => renderHook(() => useProfessionalServices())).toThrow('ProfessionalServicesProvider');
  });
});

describe('usePatients and useCohort, reload (PAC-16)', () => {
  /** Mounts both queries with the tab in `visibility`, lets them load and `elapsedMs` of fake time pass. */
  async function reloadCounts(visibility: 'visible' | 'hidden', elapsedMs: number) {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibility);
    const mock = mockPortfolio();
    const { result } = mountPortfolio(14);
    // `vi.waitFor`: Testing Library's polls with the interval timers that are faked here.
    await vi.waitFor(() => expect(result.current.patients.isSuccess && result.current.cohort.isSuccess).toBe(true));
    await vi.advanceTimersByTimeAsync(elapsedMs);
    return mock;
  }

  afterEach(() => vi.useRealTimers());

  it('reload every 5 minutes while the tab is visible', async () => {
    const mock = await reloadCounts('visible', REFETCH_INTERVAL_MS + 1000);

    await vi.waitFor(() => expect([mock.listRequests.length, mock.cohortRequests.length]).toEqual([2, 2]));
  });

  it('do not reload while the tab is hidden', async () => {
    const mock = await reloadCounts('hidden', REFETCH_INTERVAL_MS * 2 + 1000);

    expect([mock.listRequests.length, mock.cohortRequests.length]).toEqual([1, 1]);
  });
});

describe('revoked access (PRO-13)', () => {
  it('removes the patient of a detail call that answered NO_ACTIVE_GRANT at once, shows the notice and reloads both queries', async () => {
    const mock = mockPortfolio({
      list: (n) => HttpResponse.json(patientPageDto(n === 1 ? TWO_PATIENTS : [patientRowDto({ patientId: 'p2', fullName: 'Bia Lima', initials: 'BL' })])),
      cohort: (n) => HttpResponse.json(cohortDto({ patientCount: n === 1 ? 2 : 1 })),
    });
    const { result, client, loaded } = mountPortfolio(14);
    await loaded();
    expect(result.current.revoked.notice).toBeNull();

    // The patient detail page makes this call and hands its error to the same handler.
    let handled = false;
    let cachedRightAway: PatientPage | undefined;
    act(() => {
      handled = result.current.revoked.handleError(new AppError('forbidden', { code: 'NO_ACTIVE_GRANT' }), 'p1');
      cachedRightAway = client.getQueryData<PatientPage>(patientsQueryKey(14, 1, 50));
    });

    expect(handled).toBe(true);
    expect(ids(cachedRightAway)).toEqual(['p2']);
    expect(cachedRightAway?.total).toBe(1);
    expect(result.current.revoked.notice).toBe(REVOKED_ACCESS_MESSAGE);
    expect(REVOKED_ACCESS_MESSAGE).toBe('O paciente revogou o acesso');
    await waitFor(() => expect([mock.listRequests.length, mock.cohortRequests.length]).toEqual([2, 2]));
    await waitFor(() => expect(result.current.cohort.data?.patientCount).toBe(1));
    expect(ids(result.current.patients.data)).toEqual(['p2']);
  });

  it('shows the notice and reloads the cohort when the list itself answers NO_ACTIVE_GRANT, without asking the list again and again', async () => {
    const mock = mockPortfolio({ list: revoked });
    const { result } = mountPortfolio(14);

    await waitFor(() => expect(result.current.revoked.notice).toBe(REVOKED_ACCESS_MESSAGE));
    await waitFor(() => expect(result.current.cohort.isSuccess).toBe(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mock.listRequests).toHaveLength(1);
    expect(result.current.patients.error).toMatchObject({ kind: 'forbidden', code: 'NO_ACTIVE_GRANT' });
  });

  it('shows the notice when the cohort answers NO_ACTIVE_GRANT', async () => {
    mockPortfolio({ cohort: revoked });
    const { result } = mountPortfolio(14);

    await waitFor(() => expect(result.current.revoked.notice).toBe(REVOKED_ACCESS_MESSAGE));
  });

  it('leaves other failures alone: no notice, no reload', async () => {
    const mock = mockPortfolio({ list: wrongRole });
    const { result } = mountPortfolio(14);
    await waitFor(() => expect(result.current.patients.isError).toBe(true));
    await waitFor(() => expect(result.current.cohort.isSuccess).toBe(true));

    const handled = [
      new AppError('forbidden', { code: 'FORBIDDEN_ROLE' }),
      new AppError('forbidden'),
      new AppError('unavailable', { code: 'NO_ACTIVE_GRANT' }),
      new Error('NO_ACTIVE_GRANT'),
    ].map((error) => result.current.revoked.handleError(error, 'p1'));

    expect(handled).toEqual([false, false, false, false]);
    expect(result.current.revoked.notice).toBeNull();
    expect([mock.listRequests.length, mock.cohortRequests.length]).toEqual([1, 1]);
  });

  it('lets the page dismiss the notice', async () => {
    mockPortfolio();
    const { result, loaded } = mountPortfolio(14);
    await loaded();
    act(() => {
      result.current.revoked.handleError(new AppError('forbidden', { code: 'NO_ACTIVE_GRANT' }), 'p1');
    });
    expect(result.current.revoked.notice).toBe(REVOKED_ACCESS_MESSAGE);

    act(() => result.current.revoked.dismiss());

    expect(result.current.revoked.notice).toBeNull();
  });

  it('leaves the list and its total as they are for a patient that is not in it', async () => {
    mockPortfolio();
    const { result, client, loaded } = mountPortfolio(14);
    await loaded();
    let cachedRightAway: PatientPage | undefined;

    act(() => {
      result.current.revoked.handleError(new AppError('forbidden', { code: 'NO_ACTIVE_GRANT' }), 'ghost');
      cachedRightAway = client.getQueryData<PatientPage>(patientsQueryKey(14, 1, 50));
    });

    expect(ids(cachedRightAway)).toEqual(['p1', 'p2']);
    expect(cachedRightAway?.total).toBe(2);
  });
});

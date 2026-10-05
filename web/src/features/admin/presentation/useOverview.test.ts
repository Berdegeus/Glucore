import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountPageDto, accountRowDto } from '../../../test/adminFakes';
import { adminWrapper, mockAdmin } from '../../../test/adminHarness';
import type { AccountPage } from '../domain/overview';
import { AdminPeriodProvider, useAdminDays } from './adminPeriodContext';
import { useAdminServices } from './adminServices';
import { useOverview, useUsers } from './useOverview';

const emails = (page: AccountPage | undefined) => page?.items.map((row) => row.email);

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

/** Three widgets that read the overview of the period the page puts above them, as the dashboard mounts them. */
function mountWidgets(days: number) {
  const { wrapper: services } = adminWrapper();
  const wrapper = ({ children }: { children: ReactNode }) => services({ children: createElement(AdminPeriodProvider, { days, children }) });
  // Spread: TanStack Query re-renders only for the fields read while rendering, and the test reads them afterwards.
  const useWidget = () => ({ ...useOverview(useAdminDays()) });
  return renderHook(() => ({ accounts: useWidget(), grants: useWidget(), patients: useWidget() }), { wrapper });
}

describe('useOverview (ADM-01, ADM-07)', () => {
  it('makes one overview request for every widget of the period', async () => {
    const mock = mockAdmin();
    const { result } = mountWidgets(30);

    await waitFor(() => expect(Object.values(result.current).every((query) => query.isSuccess)).toBe(true));

    expect(mock.overviewRequests).toHaveLength(1);
    expect(mock.overviewRequests[0]?.searchParams.get('days')).toBe('30');
    expect(result.current.accounts.data?.accounts.total).toBe(42);
    expect(result.current.grants.data).toBe(result.current.accounts.data);
  });

  it('asks again when the period changes, and only then', async () => {
    const mock = mockAdmin();
    const { wrapper } = adminWrapper();
    const { result, rerender } = renderHook(({ days }) => ({ ...useOverview(days) }), { wrapper, initialProps: { days: 30 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ days: 30 });
    rerender({ days: 7 });
    await waitFor(() => expect(mock.overviewRequests).toHaveLength(2));
    rerender({ days: 90 });
    await waitFor(() => expect(mock.overviewRequests).toHaveLength(3));

    expect(mock.overviewRequests.map((url) => url.searchParams.get('days'))).toEqual(['30', '7', '90']);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('surfaces a 403 FORBIDDEN_ROLE as a forbidden error', async () => {
    mockAdmin({ overview: () => HttpResponse.json({ error: 'Wrong role', code: 'FORBIDDEN_ROLE' }, { status: 403 }) });
    const { wrapper } = adminWrapper();
    const { result } = renderHook(() => ({ ...useOverview(30) }), { wrapper });

    await waitFor(() => expect(result.current.error).toMatchObject({ kind: 'forbidden', code: 'FORBIDDEN_ROLE' }));
  });
});

describe('useUsers (ADM-04)', () => {
  it('asks for the first page of 25 with the filters it is given', async () => {
    const mock = mockAdmin();
    const { wrapper } = adminWrapper();
    const { result } = renderHook(() => ({ ...useUsers({ role: 'PATIENT', status: 'ACTIVE', q: 'ana' }) }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(emails(result.current.data)).toEqual(['ana@example.com']);
    expect(Object.fromEntries(mock.usersRequests[0]?.searchParams ?? [])).toEqual({ role: 'PATIENT', status: 'ACTIVE', q: 'ana', page: '1', limit: '25' });
  });

  it('keeps the page on screen while the next one loads only with keepPrevious', async () => {
    /** Turns from page 1 to page 2 and returns what the hook held in between. */
    async function heldWhileLoading(keepPrevious: boolean) {
      const second = [accountRowDto({ id: 'u2', email: 'bia@example.com' })];
      mockAdmin({ users: (n) => HttpResponse.json(accountPageDto(n === 1 ? [accountRowDto()] : second)) });
      const { result, rerender } = renderHook(({ page }) => ({ ...useUsers({ page }, keepPrevious) }), { wrapper: adminWrapper().wrapper, initialProps: { page: 1 } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      rerender({ page: 2 });
      const held = emails(result.current.data);
      await waitFor(() => expect(emails(result.current.data)).toEqual(['bia@example.com']));
      return held;
    }

    expect(await heldWhileLoading(true)).toEqual(['ana@example.com']);
    expect(await heldWhileLoading(false)).toBeUndefined();
  });
});

describe('the admin providers', () => {
  it('fail clearly when no services or period provider is above the hooks', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAdminServices())).toThrow('useAdminServices needs an AdminServicesProvider above it');
    expect(() => renderHook(() => useAdminDays())).toThrow('useAdminDays needs an AdminPeriodProvider above it');
  });
});

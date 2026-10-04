import { focusManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../../../composition/container';
import type { Role } from '../../../shared/domain/role';
import { createQueryClient, REFETCH_INTERVAL_MS } from '../../../shared/presentation/queryClient';
import { API_BASE } from '../../../test/httpClient';
import { widgetDefinition } from '../../../test/layoutFakes';
import { server } from '../../../test/server';
import { defaultLayoutFor } from '../domain/defaultLayout';
import { LayoutServicesProvider, useLayoutServices } from './layoutServices';
import { useLayout } from './useLayout';
import { registerWidget } from './widgetRegistry';

const ENDPOINT = `${API_BASE}/preferences/dashboard`;
const NO_COMPONENT = () => Promise.resolve({ default: () => null });

// The container reads the app registry, so the widgets a saved layout may name are registered there.
registerWidget(widgetDefinition('kpi-tir'), NO_COMPONENT);
registerWidget(widgetDefinition('chart-trend'), NO_COMPONENT);
registerWidget(widgetDefinition('pro-table', { roles: ['HEALTH_PROFESSIONAL'] }), NO_COMPONENT);

let requests = 0;

function answerWith(body: JsonBodyType, init?: ResponseInit) {
  server.use(
    http.get(ENDPOINT, () => {
      requests += 1;
      return HttpResponse.json(body, init);
    }),
  );
}

function setup(client: QueryClient = new QueryClient()) {
  const services = createContainer({ apiUrl: 'http://api.test' }).useCases.layout;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, createElement(LayoutServicesProvider, { services, children }));
  return { wrapper, client };
}

/** Mounts `useLayout` under the real container and, unless told otherwise, waits for the first answer. */
async function mountLayout(role: Role, client?: QueryClient) {
  const view = renderHook(() => useLayout(role), { wrapper: setup(client).wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}

beforeEach(() => {
  requests = 0;
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('useLayout (LAY-02, LAY-08, LAY-10)', () => {
  it('is loading with no layout until the first answer arrives', async () => {
    answerWith({ widgets: null });
    const { result } = renderHook(() => useLayout('PATIENT'), { wrapper: setup().wrapper });

    expect(result.current).toEqual({ layout: null, isLoading: true, degraded: false });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('uses the default layout of the role when nothing is saved', async () => {
    answerWith({ widgets: null });
    const { result } = await mountLayout('PATIENT');

    expect(result.current).toEqual({ layout: defaultLayoutFor('PATIENT'), isLoading: false, degraded: false });
  });

  it('returns the saved layout without the items the catalog or the role rule out', async () => {
    answerWith({
      widgets: [
        { id: 'chart-trend', size: 'L' },
        { id: 'retired', size: 'M' },
        { id: 'pro-table', size: 'M' },
        { id: 'kpi-tir', size: 'S' },
      ],
    });
    const { result } = await mountLayout('PATIENT');

    expect(result.current.layout).toEqual({
      widgets: [
        { id: 'chart-trend', size: 'L' },
        { id: 'kpi-tir', size: 'S' },
      ],
    });
    expect(result.current.degraded).toBe(false);
  });

  it.each([
    ['the gateway is down', { error: 'down' }, { status: 503 }],
    ['the answer is malformed', { widgets: [{ id: 'kpi-tir', size: 'XL' }] }, undefined],
  ])('falls back to the default and marks degraded when %s', async (_label, body, init) => {
    answerWith(body, init);
    const { result } = await mountLayout('HEALTH_PROFESSIONAL');

    expect(result.current).toEqual({ layout: defaultLayoutFor('HEALTH_PROFESSIONAL'), isLoading: false, degraded: true });
  });

  it('keeps the layouts of two roles apart', async () => {
    answerWith({ widgets: null });
    const { result, rerender } = renderHook(({ role }) => useLayout(role), {
      wrapper: setup().wrapper,
      initialProps: { role: 'PATIENT' as Role },
    });
    await waitFor(() => expect(result.current.layout).toEqual(defaultLayoutFor('PATIENT')));

    rerender({ role: 'ADMINISTRATOR' });

    await waitFor(() => expect(result.current.layout).toEqual(defaultLayoutFor('ADMINISTRATOR')));
  });

  it('fails clearly when no provider is above it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useLayoutServices())).toThrow('LayoutServicesProvider');

    vi.restoreAllMocks();
  });
});

describe('useLayout reload policy (the layout is not dashboard data)', () => {
  // Only the interval timers are faked: the reload of the query client fires from
  // `setInterval`, while MSW and the test's own waiting keep real timers.
  const fakeIntervals = () => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

  it('is not refetched after 5 minutes, although the app query client reloads every query on that interval', async () => {
    fakeIntervals();
    answerWith({ widgets: null });
    const { result } = renderHook(() => useLayout('PATIENT'), { wrapper: setup(createQueryClient()).wrapper });
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(requests).toBe(1);

    await vi.advanceTimersByTimeAsync(REFETCH_INTERVAL_MS * 2);

    expect(requests).toBe(1);
  });

  it('control: a query that keeps the client default is refetched on that interval', async () => {
    fakeIntervals();
    answerWith({ widgets: null });
    const { wrapper } = setup(createQueryClient());
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['control'],
          queryFn: async () => {
            requests += 1;
            return requests;
          },
        }),
      { wrapper },
    );
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests).toBe(1);

    await vi.advanceTimersByTimeAsync(REFETCH_INTERVAL_MS + 1000);

    await vi.waitFor(() => expect(requests).toBe(2));
  });

  it('is not refetched when the window regains focus', async () => {
    answerWith({ widgets: null });
    await mountLayout('PATIENT', createQueryClient());

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests).toBe(1);
  });

  it('keeps a loaded layout across a remount without asking again', async () => {
    answerWith({ widgets: null });
    const { wrapper } = setup();
    const first = renderHook(() => useLayout('PATIENT'), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const second = renderHook(() => useLayout('PATIENT'), { wrapper });

    expect(second.result.current.layout).toEqual(defaultLayoutFor('PATIENT'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toBe(1);
  });

  it('asks again on the next mount after a degraded result, so the fallback does not stick', async () => {
    answerWith({ error: 'down' }, { status: 503 });
    const { wrapper } = setup();
    const first = renderHook(() => useLayout('PATIENT'), { wrapper });
    await waitFor(() => expect(first.result.current.degraded).toBe(true));
    first.unmount();
    answerWith({ widgets: [{ id: 'kpi-tir', size: 'S' }] });

    const second = renderHook(() => useLayout('PATIENT'), { wrapper });

    await waitFor(() => expect(second.result.current.degraded).toBe(false));
    expect(second.result.current.layout).toEqual({ widgets: [{ id: 'kpi-tir', size: 'S' }] });
    expect(requests).toBe(2);
  });
});

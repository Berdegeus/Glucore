import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../../../composition/container';
import { createQueryClient, REFETCH_INTERVAL_MS } from '../../../shared/presentation/queryClient';
import { API_BASE } from '../../../test/httpClient';
import { server } from '../../../test/server';
import { summaryFixture } from '../../../test/summaryFakes';
import type { DateRange } from '../domain/period';
import { SummaryScopeProvider, type SummaryScope } from './summaryScope';
import { SummaryServicesProvider, useSummaryServices } from './summaryServices';
import { summaryQueryKey, useSummary } from './useSummary';

const OWN = `${API_BASE}/dashboard/summary`;
const PROFESSIONAL = `${API_BASE}/professional/patients/:id/summary`;
const RANGE: DateRange = { from: '2026-08-05', to: '2026-08-06' };
const OTHER_RANGE: DateRange = { from: '2026-07-01', to: '2026-07-31' };

/** Requests that reached each route, with the query they carried. */
let own: URLSearchParams[] = [];
let professional: { id: string; params: URLSearchParams }[] = [];

beforeEach(() => {
  own = [];
  professional = [];
  server.use(
    http.get(OWN, ({ request }) => {
      own.push(new URL(request.url).searchParams);
      return HttpResponse.json(summaryFixture({ gmiPercent: 6.5 }));
    }),
    http.get(PROFESSIONAL, ({ request, params }) => {
      professional.push({ id: String(params.id), params: new URL(request.url).searchParams });
      return HttpResponse.json(summaryFixture({ gmiPercent: 8.8 }));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

function setup(client: QueryClient = createQueryClient(), scope?: SummaryScope) {
  const services = createContainer({ apiUrl: 'http://api.test' }).useCases.summary;
  const wrapper = ({ children }: { children: ReactNode }) => {
    const inner = createElement(SummaryServicesProvider, { services, children });
    const scoped = scope ? createElement(SummaryScopeProvider, { scope, children: inner }) : inner;
    return createElement(QueryClientProvider, { client }, scoped);
  };
  return { wrapper, client };
}

const setVisibility = (state: 'visible' | 'hidden') =>
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);

// Only the interval timers are faked: the reload fires from `setInterval`,
// while MSW and the waiting of the test itself keep real timers.
const fakeIntervals = () => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

describe('useSummary (PAC-17)', () => {
  it('loads the summary of the period for the signed-in patient, in the browser zone', async () => {
    const { result } = renderHook(() => useSummary(RANGE), { wrapper: setup().wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.gmiPercent).toBe(6.5);
    expect(own).toHaveLength(1);
    expect(own[0]?.get('from')).toBe('2026-08-05');
    expect(own[0]?.get('to')).toBe('2026-08-06');
    expect(own[0]?.get('tz')).toBeTruthy();
  });

  it('makes one request for two widgets that mount together with the same period', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ first: useSummary(RANGE), second: useSummary(RANGE) }), { wrapper });

    await waitFor(() => expect(result.current.first.isSuccess && result.current.second.isSuccess).toBe(true));

    expect(own).toHaveLength(1);
    expect(result.current.second.data).toBe(result.current.first.data);
  });

  it('makes no new request for a widget that mounts later, while the data is fresh', async () => {
    const { wrapper } = setup();
    const first = renderHook(() => useSummary(RANGE), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    const second = renderHook(() => useSummary(RANGE), { wrapper });

    expect(second.result.current.data).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(own).toHaveLength(1);
  });

  it('makes a separate request for a different period', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ a: useSummary(RANGE), b: useSummary(OTHER_RANGE) }), { wrapper });

    await waitFor(() => expect(result.current.a.isSuccess && result.current.b.isSuccess).toBe(true));

    expect(own.map((params) => params.get('from')).sort()).toEqual(['2026-07-01', '2026-08-05']);
  });

  it('fails clearly when no services provider is above it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useSummaryServices())).toThrow('SummaryServicesProvider');
  });
});

describe('useSummary, scope (PAC-01)', () => {
  it('reads a linked patient from the professional route', async () => {
    const { wrapper } = setup(createQueryClient(), { patientId: 'p-1' });
    const { result } = renderHook(() => useSummary(RANGE), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.gmiPercent).toBe(8.8);
    expect(own).toHaveLength(0);
    expect(professional.map((call) => call.id)).toEqual(['p-1']);
    expect(professional[0]?.params.get('from')).toBe('2026-08-05');
  });

  it('never shares a cache entry between the own scope and a linked patient, for the same period', async () => {
    const client = createQueryClient();
    const ownView = renderHook(() => useSummary(RANGE), { wrapper: setup(client).wrapper });
    const linkedView = renderHook(() => useSummary(RANGE), { wrapper: setup(client, { patientId: 'p-1' }).wrapper });

    await waitFor(() => expect(ownView.result.current.isSuccess && linkedView.result.current.isSuccess).toBe(true));

    expect(ownView.result.current.data?.gmiPercent).toBe(6.5);
    expect(linkedView.result.current.data?.gmiPercent).toBe(8.8);
    expect(own).toHaveLength(1);
    expect(professional).toHaveLength(1);
  });

  it('keeps the entries of two linked patients and of the own scope apart', () => {
    const keys = ['p-1', 'p-2', undefined].map((patientId) => JSON.stringify(summaryQueryKey({ patientId }, RANGE)));

    expect(new Set(keys).size).toBe(3);
  });
});

describe('useSummary, reload (PAC-16)', () => {
  it('reloads after 5 minutes while the tab is visible', async () => {
    fakeIntervals();
    setVisibility('visible');
    const { result } = renderHook(() => useSummary(RANGE), { wrapper: setup().wrapper });
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(own).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(REFETCH_INTERVAL_MS + 1000);

    await vi.waitFor(() => expect(own).toHaveLength(2));
  });

  it('does not reload after 5 minutes, nor after 10, while the tab is hidden', async () => {
    fakeIntervals();
    setVisibility('hidden');
    const { result } = renderHook(() => useSummary(RANGE), { wrapper: setup().wrapper });
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(own).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(REFETCH_INTERVAL_MS * 2 + 1000);

    expect(own).toHaveLength(1);
  });

  it('holds under a plain query client that sets no interval of its own', async () => {
    fakeIntervals();
    setVisibility('visible');
    const { result } = renderHook(() => useSummary(RANGE), { wrapper: setup(new QueryClient()).wrapper });
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    await vi.advanceTimersByTimeAsync(REFETCH_INTERVAL_MS + 1000);

    await vi.waitFor(() => expect(own).toHaveLength(2));
  });
});

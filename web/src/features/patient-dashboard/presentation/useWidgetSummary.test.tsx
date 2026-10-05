import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { summaryFixture } from '../../../test/summaryFakes';
import type { LoadPatientSummary } from '../application/loadPatientSummary';
import type { DateRange } from '../domain/period';
import { PeriodProvider } from './periodContext';
import { SummaryServicesProvider } from './summaryServices';
import { useWidgetSummary } from './useWidgetSummary';

const RANGE: DateRange = { from: '2026-08-05', to: '2026-08-06' };

afterEach(() => vi.restoreAllMocks());

function setup(range: DateRange = RANGE) {
  const loadPatientSummary = vi.fn<LoadPatientSummary>().mockResolvedValue(summaryFixture({ gmiPercent: 7.1 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <SummaryServicesProvider services={{ loadPatientSummary }}>
        <PeriodProvider range={range}>{children}</PeriodProvider>
      </SummaryServicesProvider>
    </QueryClientProvider>
  );
  return { wrapper, loadPatientSummary };
}

describe('useWidgetSummary (PAC-17)', () => {
  it('loads the summary of the period the page chose', async () => {
    const { wrapper, loadPatientSummary } = setup();
    const { result } = renderHook(() => useWidgetSummary(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.gmiPercent).toBe(7.1);
    expect(loadPatientSummary).toHaveBeenCalledTimes(1);
    expect(loadPatientSummary).toHaveBeenCalledWith({ range: RANGE });
  });

  it('makes one request for several widgets on the same page', async () => {
    const { wrapper, loadPatientSummary } = setup();
    const { result } = renderHook(() => [useWidgetSummary(), useWidgetSummary(), useWidgetSummary()], { wrapper });

    await waitFor(() => expect(result.current.every((query) => query.isSuccess)).toBe(true));

    expect(loadPatientSummary).toHaveBeenCalledTimes(1);
  });

  it('fails clearly outside a period provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useWidgetSummary())).toThrow('usePeriod needs a PeriodProvider above it');
  });
});

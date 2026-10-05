import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DateRange } from '../domain/period';
import { PeriodProvider, usePeriod } from './periodContext';

const RANGE: DateRange = { from: '2026-08-05', to: '2026-08-06' };
const OTHER: DateRange = { from: '2026-07-01', to: '2026-07-31' };

afterEach(() => vi.restoreAllMocks());

describe('PeriodProvider (PAC-17)', () => {
  it('hands the period of the page to the widgets below it', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <PeriodProvider range={RANGE}>{children}</PeriodProvider>;

    const { result } = renderHook(() => usePeriod(), { wrapper });

    expect(result.current).toEqual(RANGE);
  });

  it('follows the period when the filter changes it', () => {
    let range = RANGE;
    const wrapper = ({ children }: { children: ReactNode }) => <PeriodProvider range={range}>{children}</PeriodProvider>;
    const { result, rerender } = renderHook(() => usePeriod(), { wrapper });

    range = OTHER;
    rerender();

    expect(result.current).toEqual(OTHER);
  });

  it('fails clearly when no provider is above it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => usePeriod())).toThrow('usePeriod needs a PeriodProvider above it');
  });
});

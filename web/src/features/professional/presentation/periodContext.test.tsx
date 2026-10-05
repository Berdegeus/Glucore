import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfessionalPeriodProvider, usePeriodDays } from './periodContext';

afterEach(() => vi.restoreAllMocks());

describe('ProfessionalPeriodProvider (PRO-05)', () => {
  it('hands the period of the page to the widgets below it', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <ProfessionalPeriodProvider days={14}>{children}</ProfessionalPeriodProvider>;

    const { result } = renderHook(() => usePeriodDays(), { wrapper });

    expect(result.current).toBe(14);
  });

  it('follows the period when the filter changes it', () => {
    let days = 7;
    const wrapper = ({ children }: { children: ReactNode }) => <ProfessionalPeriodProvider days={days}>{children}</ProfessionalPeriodProvider>;
    const { result, rerender } = renderHook(() => usePeriodDays(), { wrapper });

    days = 90;
    rerender();

    expect(result.current).toBe(90);
  });

  it('fails clearly when no provider is above it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => usePeriodDays())).toThrow('usePeriodDays needs a ProfessionalPeriodProvider above it');
  });
});

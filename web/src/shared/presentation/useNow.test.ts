import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './useNow';

const START = Date.parse('2026-08-06T08:00:00.000Z');
const MINUTE_MS = 60_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(START);
});

afterEach(() => vi.useRealTimers());

describe('useNow', () => {
  it('starts at the current time', () => {
    const { result } = renderHook(() => useNow());

    expect(result.current.getTime()).toBe(START);
  });

  it('moves on every minute, and not before', () => {
    const { result } = renderHook(() => useNow());

    act(() => vi.advanceTimersByTime(MINUTE_MS - 1));
    expect(result.current.getTime()).toBe(START);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.getTime()).toBe(START + MINUTE_MS);

    act(() => vi.advanceTimersByTime(MINUTE_MS));
    expect(result.current.getTime()).toBe(START + 2 * MINUTE_MS);
  });

  it('takes another interval when asked', () => {
    const { result } = renderHook(() => useNow(1000));

    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.getTime()).toBe(START + 1000);
  });

  it('stops its timer when the component unmounts', () => {
    const { unmount } = renderHook(() => useNow());
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

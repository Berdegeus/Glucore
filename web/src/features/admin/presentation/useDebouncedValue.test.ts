import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  const settle = (value: string, delayMs = 300) => renderHook(({ current }) => useDebouncedValue(current, delayMs), { initialProps: { current: value } });

  it('starts with the value it was given', () => {
    expect(settle('a').result.current).toBe('a');
  });

  it('follows a new value only after the delay has passed, 299 ms not being enough', () => {
    const { result, rerender } = settle('a');

    rerender({ current: 'ab' });
    act(() => void vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  it('waits again from the last change, so a value that keeps changing never settles in between', () => {
    const { result, rerender } = settle('a');

    rerender({ current: 'ab' });
    act(() => void vi.advanceTimersByTime(200));
    rerender({ current: 'abc' });
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});

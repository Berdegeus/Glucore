import { useEffect, useState } from 'react';

/** `value` as it stood `delayMs` ago: it follows a value that keeps changing (a search box) only once it settles. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

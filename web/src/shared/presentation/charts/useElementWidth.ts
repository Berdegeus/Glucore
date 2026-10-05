import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Width of an element, kept current with a `ResizeObserver`, so a chart that is
 * not built on Recharts' `ResponsiveContainer` redraws when its container
 * changes size (RSP-05). `fallback` is used until the element is measured.
 */
export function useElementWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measured = Math.round(element.getBoundingClientRect().width);
    if (measured > 0) setWidth(measured);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

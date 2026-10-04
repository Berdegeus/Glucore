import { act } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/*
 * jsdom has no layout: every element measures 0 x 0, so Recharts'
 * `ResponsiveContainer` draws nothing. This stands in for the browser: the
 * container reports a size through `getBoundingClientRect` and through a
 * fake `ResizeObserver` that the test can fire (RSP-05).
 */

interface Size {
  width: number;
  height: number;
}

type Callback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

class FakeResizeObserver {
  static instances = new Set<FakeResizeObserver>();
  readonly targets = new Set<Element>();

  constructor(private readonly callback: Callback) {
    FakeResizeObserver.instances.add(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    FakeResizeObserver.instances.delete(this);
  }

  notify(size: Size): void {
    const entries = [...this.targets].map((target) => ({ target, contentRect: { ...size } }));
    this.callback(entries as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

const CONTAINER_CLASS = 'recharts-responsive-container';

export interface ChartContainer {
  /** Changes the size of every chart container and fires the observers, as a browser does. */
  resize(size: Partial<Size>): void;
  readonly size: Size;
}

/**
 * Call at the top of a describe/test file. Containers measure `width` x
 * `height` until `resize` is called; the stubs are removed after each test.
 */
export function stubChartContainer(initial: Size = { width: 600, height: 300 }): ChartContainer {
  const current = { ...initial };
  const originalRect = Element.prototype.getBoundingClientRect;
  const originalObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    Object.assign(current, initial);
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    Element.prototype.getBoundingClientRect = function measure(this: Element): DOMRect {
      const measured = this.classList.contains(CONTAINER_CLASS) ? current : { width: 0, height: 0 };
      return { x: 0, y: 0, top: 0, left: 0, right: measured.width, bottom: measured.height, ...measured } as DOMRect;
    };
  });

  afterEach(() => {
    FakeResizeObserver.instances.clear();
    globalThis.ResizeObserver = originalObserver;
    Element.prototype.getBoundingClientRect = originalRect;
  });

  return {
    get size() {
      return { ...current };
    },
    resize(size) {
      Object.assign(current, size);
      act(() => {
        for (const observer of FakeResizeObserver.instances) observer.notify({ ...current });
      });
    },
  };
}

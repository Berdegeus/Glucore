import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const ROW_HEIGHT = 50;

/**
 * jsdom has no layout, so dnd-kit cannot tell where the neighbours are. This
 * stacks every grid cell (`[data-size]`) in a column, one row each; call
 * `vi.restoreAllMocks()` in `afterEach`.
 */
export function stackGridCells(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const index = this.hasAttribute('data-size') ? Array.from(this.parentElement?.children ?? []).indexOf(this) : 0;
    const top = index * ROW_HEIGHT;
    return { x: 0, y: top, top, left: 0, width: 200, height: ROW_HEIGHT - 10, right: 200, bottom: top + ROW_HEIGHT - 10, toJSON: () => ({}) };
  });
}

/**
 * One key press on the drag handle. The keyboard sensor binds its move and
 * drop listener on the next macrotask, so each press yields once before the next.
 */
export const press = (element: Element, code: string) =>
  act(async () => {
    fireEvent.keyDown(element, { code, key: code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

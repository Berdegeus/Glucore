import { describe, expect, it } from 'vitest';
import {
  addWidget,
  LayoutError,
  MAX_WIDGETS,
  moveWidget,
  removeWidget,
  resizeWidget,
  type DashboardLayout,
  type LayoutErrorReason,
} from './layout';
import { layoutOf as layoutOfItems, layoutOfIds as layoutOf, widgetDefinition as definition } from '../../../test/layoutFakes';

const idsOf = (layout: DashboardLayout) => layout.widgets.map((item) => item.id);

function failureOf(action: () => unknown): LayoutErrorReason | undefined {
  try {
    action();
  } catch (error) {
    if (error instanceof LayoutError) return error.reason;
    throw error;
  }
  return undefined;
}

describe('addWidget (LAY-03)', () => {
  it('appends the widget at its default size', () => {
    expect(addWidget(layoutOf('a'), definition('b', { defaultSize: 'L' })).widgets).toEqual([
      { id: 'a', size: 'S' },
      { id: 'b', size: 'L' },
    ]);
  });

  it('appends at a chosen size the widget declares', () => {
    expect(addWidget(layoutOf(), definition('a'), 'S').widgets).toEqual([{ id: 'a', size: 'S' }]);
  });

  it('does not change the layout it was given', () => {
    const before = layoutOf('a');
    addWidget(before, definition('b'));
    expect(idsOf(before)).toEqual(['a']);
  });

  it('accepts the 20th widget', () => {
    const nineteen = layoutOf(...Array.from({ length: MAX_WIDGETS - 1 }, (_, i) => `w${i}`));

    expect(addWidget(nineteen, definition('last')).widgets).toHaveLength(MAX_WIDGETS);
  });

  it('refuses the 21st widget', () => {
    const twenty = layoutOf(...Array.from({ length: MAX_WIDGETS }, (_, i) => `w${i}`));

    expect(failureOf(() => addWidget(twenty, definition('extra')))).toBe('limit-reached');
  });

  it('refuses an id already on the layout', () => {
    expect(failureOf(() => addWidget(layoutOf('a'), definition('a')))).toBe('duplicate');
  });

  it('refuses a size the widget does not declare', () => {
    expect(failureOf(() => addWidget(layoutOf(), definition('a', { sizes: ['S', 'M'] }), 'L'))).toBe('size-not-allowed');
  });
});

describe('removeWidget (LAY-03)', () => {
  it('drops the widget and keeps the order of the rest', () => {
    expect(idsOf(removeWidget(layoutOf('a', 'b', 'c'), 'b'))).toEqual(['a', 'c']);
  });

  it('refuses an id that is not on the layout', () => {
    expect(failureOf(() => removeWidget(layoutOf('a'), 'z'))).toBe('unknown-widget');
  });
});

describe('moveWidget (LAY-04, LAY-05)', () => {
  const abcd = layoutOf('a', 'b', 'c', 'd');

  it.each([
    ['one place later', 'b', 2, ['a', 'c', 'b', 'd']],
    ['one place earlier', 'c', 1, ['a', 'c', 'b', 'd']],
    ['to the start', 'd', 0, ['d', 'a', 'b', 'c']],
    ['to the end', 'a', 3, ['b', 'c', 'd', 'a']],
    ['the first widget to its own place', 'a', 0, ['a', 'b', 'c', 'd']],
    ['the last widget to its own place', 'd', 3, ['a', 'b', 'c', 'd']],
  ])('moves %s', (_label, id, toIndex, expected) => {
    expect(idsOf(moveWidget(abcd, id, toIndex))).toEqual(expected);
  });

  it('keeps the size of the moved widget', () => {
    const layout = layoutOfItems({ id: 'a', size: 'L' }, { id: 'b', size: 'S' });

    expect(moveWidget(layout, 'a', 1).widgets[1]).toEqual({ id: 'a', size: 'L' });
  });

  it.each([-1, 4, 1.5, Number.NaN])('refuses the position %s', (toIndex) => {
    expect(failureOf(() => moveWidget(abcd, 'a', toIndex))).toBe('out-of-range');
  });

  it('refuses an id that is not on the layout', () => {
    expect(failureOf(() => moveWidget(abcd, 'z', 0))).toBe('unknown-widget');
  });
});

describe('resizeWidget (LAY-06)', () => {
  it('changes only the size of that widget', () => {
    expect(resizeWidget(layoutOf('a', 'b'), definition('b'), 'L').widgets).toEqual([
      { id: 'a', size: 'S' },
      { id: 'b', size: 'L' },
    ]);
  });

  it('refuses a size the widget does not declare', () => {
    expect(failureOf(() => resizeWidget(layoutOf('a'), definition('a', { sizes: ['S', 'M'] }), 'L'))).toBe('size-not-allowed');
  });

  it('refuses a widget that is not on the layout', () => {
    expect(failureOf(() => resizeWidget(layoutOf('a'), definition('z'), 'M'))).toBe('unknown-widget');
  });
});

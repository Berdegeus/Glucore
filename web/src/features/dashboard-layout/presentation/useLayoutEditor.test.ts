import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { layoutOf, layoutOfIds, widgetDefinition } from '../../../test/layoutFakes';
import { defaultLayoutFor } from '../domain/defaultLayout';
import { MAX_WIDGETS, type DashboardLayout } from '../domain/layout';
import { EDIT_MESSAGES, useLayoutEditor } from './useLayoutEditor';

const SAVED = layoutOfIds('a', 'b', 'c');
const ids = (layout: DashboardLayout) => layout.widgets.map((item) => item.id);

/** A layout of exactly `count` widgets named w1..wN. */
const fullOf = (count: number) => layoutOfIds(...Array.from({ length: count }, (_, at) => `w${at + 1}`));

function setup(saved: DashboardLayout = SAVED) {
  const view = renderHook(() => useLayoutEditor('PATIENT', saved));
  const started = () => {
    act(() => view.result.current.start());
    return view;
  };
  return { ...view, started };
}

describe('useLayoutEditor lifecycle (LAY-03)', () => {
  it('is not editing at first and shows the saved layout', () => {
    const { result } = setup();

    expect(result.current).toMatchObject({ editing: false, draft: SAVED, dirty: false, notice: null });
  });

  it('starts from the saved layout, with nothing to save yet', () => {
    const { result, started } = setup();

    started();

    expect(result.current).toMatchObject({ editing: true, draft: SAVED, dirty: false });
  });

  it('ignores an edit made outside the edit mode', () => {
    const { result } = setup();

    act(() => result.current.remove('a'));

    expect(result.current.draft).toBe(SAVED);
    expect(result.current.editing).toBe(false);
  });

  it('keeps the draft when start is called again while editing', () => {
    const { result, started } = setup();
    started();
    act(() => result.current.remove('a'));

    act(() => result.current.start());

    expect(ids(result.current.draft)).toEqual(['b', 'c']);
  });

  it('drops the draft on cancel and goes back to the saved layout', () => {
    const { result, started } = setup();
    started();
    act(() => result.current.remove('a'));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.cancel());

    expect(result.current).toMatchObject({ editing: false, draft: SAVED, dirty: false });
  });

  it('leaves the edit mode on finish, showing the layout that was saved in its place', () => {
    const view = renderHook(({ saved }) => useLayoutEditor('PATIENT', saved), { initialProps: { saved: SAVED } });
    act(() => view.result.current.start());
    act(() => view.result.current.remove('a'));
    const savedNow = layoutOfIds('b', 'c');

    act(() => view.result.current.finish());
    view.rerender({ saved: savedNow });

    expect(view.result.current).toMatchObject({ editing: false, draft: savedNow, dirty: false });
  });
});

describe('useLayoutEditor actions (LAY-03, LAY-04, LAY-06)', () => {
  it('adds a widget at the end, at the size its definition prefers', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.add(widgetDefinition('d', { defaultSize: 'L' })));

    expect(result.current.draft.widgets.at(-1)).toEqual({ id: 'd', size: 'L' });
    expect(result.current.dirty).toBe(true);
  });

  it('removes a widget', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.remove('b'));

    expect(ids(result.current.draft)).toEqual(['a', 'c']);
  });

  it('moves a widget to a position', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.move('a', 2));

    expect(ids(result.current.draft)).toEqual(['b', 'c', 'a']);
  });

  it('resizes a widget among the sizes it declares', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.resize(widgetDefinition('b'), 'L'));

    expect(result.current.draft.widgets[1]).toEqual({ id: 'b', size: 'L' });
  });

  it('builds on each other when two edits happen in one event', () => {
    const { result, started } = setup();
    started();

    act(() => {
      result.current.remove('a');
      result.current.remove('b');
    });

    expect(ids(result.current.draft)).toEqual(['c']);
  });

  it('is clean again when the edits bring the draft back to the saved layout', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.move('a', 2));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.move('a', 0));

    expect(result.current.dirty).toBe(false);
  });

  it('counts a size change alone as a change', () => {
    const { result, started } = setup(layoutOf({ id: 'a', size: 'S' }));
    started();

    act(() => result.current.resize(widgetDefinition('a'), 'M'));

    expect(result.current.dirty).toBe(true);
  });

  it('replaces the draft with the default layout of the role, still waiting to be saved', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.resetDraft());

    expect(result.current.draft).toEqual(defaultLayoutFor('PATIENT'));
    expect(result.current.dirty).toBe(true);
  });
});

describe('useLayoutEditor limits (LAY-11)', () => {
  it('adds the 20th widget', () => {
    const { result, started } = setup(fullOf(MAX_WIDGETS - 1));
    started();

    act(() => result.current.add(widgetDefinition('last')));

    expect(result.current.draft.widgets).toHaveLength(MAX_WIDGETS);
    expect(result.current.notice).toBeNull();
  });

  it('refuses a 21st widget with a message instead of throwing, keeping the draft', () => {
    const full = fullOf(MAX_WIDGETS);
    const { result, started } = setup(full);
    started();

    act(() => result.current.add(widgetDefinition('one-too-many')));

    expect(result.current.draft).toEqual(full);
    expect(result.current.notice).toBe(EDIT_MESSAGES['limit-reached']);
    expect(result.current.notice).toBe('O painel aceita no máximo 20 itens. Remova um item para adicionar outro.');
  });

  it('refuses a widget already in the draft', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.add(widgetDefinition('a')));

    expect(ids(result.current.draft)).toEqual(['a', 'b', 'c']);
    expect(result.current.notice).toBe(EDIT_MESSAGES.duplicate);
  });

  it('refuses a size the widget does not declare', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.resize(widgetDefinition('a', { sizes: ['S'] }), 'L'));

    expect(result.current.draft).toEqual(SAVED);
    expect(result.current.notice).toBe(EDIT_MESSAGES['size-not-allowed']);
  });

  it('refuses to move a widget out of the layout, and clears the message on the next good edit', () => {
    const { result, started } = setup();
    started();

    act(() => result.current.move('a', 3));
    expect(result.current.notice).toBe(EDIT_MESSAGES['out-of-range']);
    act(() => result.current.move('a', 2));

    expect(result.current.notice).toBeNull();
    expect(ids(result.current.draft)).toEqual(['b', 'c', 'a']);
  });

  it('clears the message when the person cancels', () => {
    const { result, started } = setup();
    started();
    act(() => result.current.remove('zzz'));
    expect(result.current.notice).toBe(EDIT_MESSAGES['unknown-widget']);

    act(() => result.current.cancel());

    expect(result.current.notice).toBeNull();
  });
});

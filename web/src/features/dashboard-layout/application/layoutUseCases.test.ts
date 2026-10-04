import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import type { Role } from '../../../shared/domain/role';
import { layoutOf, widgetDefinition } from '../../../test/layoutFakes';
import { defaultLayoutFor } from '../domain/defaultLayout';
import type { DashboardLayout, WidgetDefinition } from '../domain/layout';
import type { LayoutRepository } from '../domain/ports';
import { createLayoutUseCases } from './layoutUseCases';

const CATALOG: readonly WidgetDefinition[] = [
  widgetDefinition('kpi-tir'),
  widgetDefinition('chart-trend'),
  widgetDefinition('pro-table', { roles: ['HEALTH_PROFESSIONAL'] }),
];

function setup(overrides: Partial<LayoutRepository> = {}, catalog: () => readonly WidgetDefinition[] = () => CATALOG) {
  const layouts = {
    load: vi.fn<LayoutRepository['load']>().mockResolvedValue(null),
    save: vi.fn<LayoutRepository['save']>((layout) => Promise.resolve(layout)),
    reset: vi.fn<LayoutRepository['reset']>().mockResolvedValue(undefined),
    ...overrides,
  };
  return { layouts, ...createLayoutUseCases({ layouts, catalog }) };
}

describe('loadLayout (LAY-02, LAY-08, LAY-10)', () => {
  it.each<Role>(['PATIENT', 'HEALTH_PROFESSIONAL', 'ADMINISTRATOR'])('uses the default of %s when nothing is saved, not degraded', async (role) => {
    const { loadLayout } = setup();

    expect(await loadLayout(role)).toEqual({ layout: defaultLayoutFor(role), degraded: false });
  });

  it('returns the saved layout with unknown, foreign and repeated items removed', async () => {
    const saved = layoutOf(
      { id: 'chart-trend', size: 'L' },
      { id: 'retired', size: 'M' },
      { id: 'pro-table', size: 'L' },
      { id: 'kpi-tir', size: 'S' },
      { id: 'chart-trend', size: 'S' },
    );
    const { loadLayout } = setup({ load: vi.fn().mockResolvedValue(saved) });

    expect(await loadLayout('PATIENT')).toEqual({
      layout: {
        widgets: [
          { id: 'chart-trend', size: 'L' },
          { id: 'kpi-tir', size: 'S' },
        ],
      },
      degraded: false,
    });
  });

  it('keeps a saved layout the person emptied, instead of falling back to the default', async () => {
    const { loadLayout } = setup({ load: vi.fn().mockResolvedValue(layoutOf()) });

    expect(await loadLayout('PATIENT')).toEqual({ layout: { widgets: [] }, degraded: false });
  });

  it.each([
    ['a network failure', new AppError('unavailable')],
    ['an unexpected response', new AppError('unknown')],
    ['a forbidden answer', new AppError('forbidden', { code: 'FORBIDDEN_ROLE' })],
  ])('falls back to the default, marked degraded, on %s', async (_label, failure) => {
    const { loadLayout } = setup({ load: vi.fn().mockRejectedValue(failure) });

    expect(await loadLayout('HEALTH_PROFESSIONAL')).toEqual({ layout: defaultLayoutFor('HEALTH_PROFESSIONAL'), degraded: true });
  });

  it('reads the catalog at load time, so a widget registered later counts', async () => {
    const catalog: WidgetDefinition[] = [];
    const saved: DashboardLayout = layoutOf({ id: 'late', size: 'S' });
    const { loadLayout } = setup({ load: vi.fn().mockResolvedValue(saved) }, () => catalog);

    expect((await loadLayout('PATIENT')).layout.widgets).toEqual([]);

    catalog.push(widgetDefinition('late'));

    expect((await loadLayout('PATIENT')).layout.widgets).toEqual([{ id: 'late', size: 'S' }]);
  });
});

describe('saveLayout (LAY-07)', () => {
  it('sends the layout as it is and returns what the repository stored', async () => {
    const edited = layoutOf({ id: 'chart-trend', size: 'L' }, { id: 'not-in-catalog', size: 'S' });
    const stored = layoutOf({ id: 'chart-trend', size: 'L' });
    const { saveLayout, layouts } = setup({ save: vi.fn().mockResolvedValue(stored) });

    expect(await saveLayout(edited)).toBe(stored);
    expect(layouts.save).toHaveBeenCalledWith(edited);
  });

  it('propagates a rejected layout unchanged, so the editor can keep the edit', async () => {
    const rejection = new AppError('validation', { code: 'INVALID_LAYOUT' });
    const { saveLayout } = setup({ save: vi.fn().mockRejectedValue(rejection) });

    await expect(saveLayout(layoutOf())).rejects.toBe(rejection);
  });
});

describe('resetLayout (LAY-09)', () => {
  it('deletes the saved layout and returns the default of the role', async () => {
    const { resetLayout, layouts } = setup();

    expect(await resetLayout('ADMINISTRATOR')).toEqual(defaultLayoutFor('ADMINISTRATOR'));
    expect(layouts.reset).toHaveBeenCalledTimes(1);
  });

  it('propagates a failed delete and returns no default, so the screen keeps the saved layout', async () => {
    const failure = new AppError('unavailable');
    const { resetLayout } = setup({ reset: vi.fn().mockRejectedValue(failure) });

    await expect(resetLayout('PATIENT')).rejects.toBe(failure);
  });
});

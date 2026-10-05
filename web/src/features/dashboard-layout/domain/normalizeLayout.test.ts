import { describe, expect, it } from 'vitest';
import type { Role } from '../../../shared/domain/role';
import { layoutOf, widgetDefinition as definition } from '../../../test/layoutFakes';
import type { DashboardLayout, WidgetDefinition } from './layout';
import { normalizeLayout } from './normalizeLayout';

const CATALOG: readonly WidgetDefinition[] = [
  definition('kpi'),
  definition('chart'),
  definition('small-only', { sizes: ['S'], defaultSize: 'S' }),
  definition('pro-table', { roles: ['HEALTH_PROFESSIONAL'] }),
  definition('shared', { roles: ['PATIENT', 'ADMINISTRATOR'] }),
];

const normalize = (layout: DashboardLayout, role: Role = 'PATIENT') => normalizeLayout(layout, CATALOG, role).widgets;

describe('normalizeLayout (LAY-10)', () => {
  it('returns a valid layout unchanged', () => {
    const valid = layoutOf({ id: 'chart', size: 'L' }, { id: 'kpi', size: 'S' }, { id: 'small-only', size: 'S' });

    expect(normalize(valid)).toEqual(valid.widgets);
  });

  it('drops an id the catalog does not know and keeps the rest in order', () => {
    const saved = layoutOf({ id: 'kpi', size: 'S' }, { id: 'retired', size: 'M' }, { id: 'chart', size: 'M' });

    expect(normalize(saved)).toEqual([
      { id: 'kpi', size: 'S' },
      { id: 'chart', size: 'M' },
    ]);
  });

  it('drops an id that belongs to another role', () => {
    const saved = layoutOf({ id: 'kpi', size: 'S' }, { id: 'pro-table', size: 'L' });

    expect(normalize(saved, 'PATIENT')).toEqual([{ id: 'kpi', size: 'S' }]);
  });

  it('keeps an id the catalog shares between roles, for each of them', () => {
    const saved = layoutOf({ id: 'shared', size: 'M' });

    expect(normalize(saved, 'PATIENT')).toHaveLength(1);
    expect(normalize(saved, 'ADMINISTRATOR')).toHaveLength(1);
    expect(normalize(saved, 'HEALTH_PROFESSIONAL')).toHaveLength(0);
  });

  it('drops a repeated id and keeps the first occurrence with its size', () => {
    const saved = layoutOf({ id: 'kpi', size: 'S' }, { id: 'chart', size: 'M' }, { id: 'kpi', size: 'L' });

    expect(normalize(saved)).toEqual([
      { id: 'kpi', size: 'S' },
      { id: 'chart', size: 'M' },
    ]);
  });

  it("gives a size the widget does not declare the widget's default size", () => {
    const saved = layoutOf({ id: 'small-only', size: 'L' }, { id: 'kpi', size: 'L' });

    expect(normalize(saved)).toEqual([
      { id: 'small-only', size: 'S' },
      { id: 'kpi', size: 'L' },
    ]);
  });

  it('returns an empty layout when nothing in it is valid', () => {
    expect(normalize(layoutOf({ id: 'retired', size: 'M' }, { id: 'pro-table', size: 'M' }))).toEqual([]);
  });

  it('does not change the layout it was given', () => {
    const saved = layoutOf({ id: 'retired', size: 'M' }, { id: 'kpi', size: 'S' });

    normalize(saved);

    expect(saved.widgets).toHaveLength(2);
  });
});

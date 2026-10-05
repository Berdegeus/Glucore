import { describe, expect, it } from 'vitest';
import { catalogIdsOf } from '../../../test/widgetHarness';
import { allDefinitions, componentFor, definitionsForRole, widgetTitle } from '../../dashboard-layout';
import './widgetCatalog';
import { PRO_HYPO_BY_HOUR_TITLE, PRO_KPI_PATIENTS_TITLE } from './widgets/widgetTitles';

describe('professional widget catalog (LAY-01, ARQ-10)', () => {
  it('registers exactly the HEALTH_PROFESSIONAL widgets of contracts/widget-catalog.json, in its order', () => {
    expect(definitionsForRole('HEALTH_PROFESSIONAL').map((definition) => definition.id)).toEqual(catalogIdsOf('HEALTH_PROFESSIONAL'));
    expect(catalogIdsOf('HEALTH_PROFESSIONAL')).toHaveLength(11);
  });

  it('registers no widget of another role', () => {
    expect(allDefinitions()).toHaveLength(definitionsForRole('HEALTH_PROFESSIONAL').length);
  });

  it.each(definitionsForRole('HEALTH_PROFESSIONAL').map((definition) => [definition.id, definition] as const))(
    '%s has a component to load, a title key the editor resolves and a title of its own',
    (id, definition) => {
      expect(componentFor(id)).not.toBeNull();
      expect(definition.titleKey).toBe(`widget.${id}`);
      expect(widgetTitle(definition)).not.toBe(id);
    },
  );

  it('gives no two widgets the same title', () => {
    const titles = allDefinitions().map((definition) => widgetTitle(definition));

    expect(new Set(titles).size).toBe(titles.length);
    expect(widgetTitle({ id: 'pro-kpi-patients', titleKey: 'widget.pro-kpi-patients' })).toBe(PRO_KPI_PATIENTS_TITLE);
    expect(widgetTitle({ id: 'pro-hypo-by-hour', titleKey: 'widget.pro-hypo-by-hour' })).toBe(PRO_HYPO_BY_HOUR_TITLE);
  });
});

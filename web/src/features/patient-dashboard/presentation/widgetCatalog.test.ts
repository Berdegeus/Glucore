import { describe, expect, it } from 'vitest';
import { catalogIdsOf } from '../../../test/widgetHarness';
import { allDefinitions, componentFor, definitionsForRole, widgetTitle } from '../../dashboard-layout';
import './widgetCatalog';
import { KPI_TIR_TITLE } from './widgets/widgetTitles';

describe('patient widget catalog (LAY-01, ARQ-10)', () => {
  it('registers exactly the PATIENT widgets of contracts/widget-catalog.json, in its order', () => {
    expect(definitionsForRole('PATIENT').map((definition) => definition.id)).toEqual(catalogIdsOf('PATIENT'));
    expect(catalogIdsOf('PATIENT')).toHaveLength(16);
  });

  it('registers no widget of another role', () => {
    expect(allDefinitions()).toHaveLength(definitionsForRole('PATIENT').length);
  });

  it('gives every registered widget a component to load, under the title key the editor resolves', () => {
    for (const definition of allDefinitions()) {
      expect(componentFor(definition.id), definition.id).not.toBeNull();
      expect(definition.titleKey).toBe(`widget.${definition.id}`);
    }
  });

  it('names every registered widget with a title of its own, so the editor never shows an id', () => {
    const titles = allDefinitions().map((definition) => widgetTitle(definition));

    for (const [at, definition] of allDefinitions().entries()) expect(titles[at], definition.id).not.toBe(definition.id);
    expect(new Set(titles).size).toBe(titles.length);
    expect(widgetTitle({ id: 'kpi-tir', titleKey: 'widget.kpi-tir' })).toBe(KPI_TIR_TITLE);
  });
});

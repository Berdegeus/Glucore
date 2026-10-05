import { describe, expect, it } from 'vitest';
import { catalogIdsOf } from '../../../test/widgetHarness';
import { allDefinitions, componentFor, definitionsForRole } from '../../dashboard-layout';
import './widgetCatalog';

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
});

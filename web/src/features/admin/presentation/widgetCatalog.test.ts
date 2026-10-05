import { describe, expect, it } from 'vitest';
import { catalogIdsOf } from '../../../test/widgetHarness';
import { componentFor, definitionsForRole, widgetTitle } from '../../dashboard-layout';
import './widgetCatalog';

/**
 * Widgets of the contract that are not built: the user cut four of the six charts. The gap is deliberate; building
 * one means registering it in `widgetCatalog.ts` and removing its id here.
 */
const DEFERRED_ADMIN_WIDGETS = ['adm-active-patients', 'adm-readings-volume', 'adm-grants', 'adm-alerts'];

const registered = () => definitionsForRole('ADMINISTRATOR').map((definition) => definition.id);

describe('administrator widget catalog (LAY-01, ARQ-10)', () => {
  it('registers only widgets of the ADMINISTRATOR list of contracts/widget-catalog.json', () => {
    expect(catalogIdsOf('ADMINISTRATOR')).toHaveLength(11);
    for (const id of registered()) expect(catalogIdsOf('ADMINISTRATOR')).toContain(id);
  });

  it('leaves unregistered exactly the deferred widgets, and registers the rest in the contract order', () => {
    const missing = catalogIdsOf('ADMINISTRATOR').filter((id) => !registered().includes(id));

    expect(missing).toEqual(DEFERRED_ADMIN_WIDGETS);
    expect(registered()).toEqual(catalogIdsOf('ADMINISTRATOR').filter((id) => !DEFERRED_ADMIN_WIDGETS.includes(id)));
    expect(registered()).toHaveLength(7);
  });

  it.each(definitionsForRole('ADMINISTRATOR').map((definition) => [definition.id, definition] as const))(
    '%s has a component to load, a title key the editor resolves and a title of its own',
    (id, definition) => {
      expect(componentFor(id)).not.toBeNull();
      expect(definition.titleKey).toBe(`widget.${id}`);
      expect(widgetTitle(definition)).not.toBe(id);
    },
  );

  it('gives no two widgets the same title', () => {
    const titles = definitionsForRole('ADMINISTRATOR').map((definition) => widgetTitle(definition));

    expect(new Set(titles).size).toBe(titles.length);
  });
});

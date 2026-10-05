/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLES } from '../../../shared/domain/role';
import { defaultLayoutFor } from './defaultLayout';
import { MAX_WIDGETS, WIDGET_SIZES } from './layout';
import { widgetIds } from './widgetIds';

// The backend validates the `PUT` against contracts/widget-catalog.json, so the
// web's own list must match it id for id (design.md, "Contrato do catálogo").
const CATALOG_PATH = join(import.meta.dirname, '../../../../../contracts/widget-catalog.json');

interface CatalogFile {
  roles: Record<string, string[]>;
  sizes: string[];
  maxWidgets: number;
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as CatalogFile;

describe('widgetIds against contracts/widget-catalog.json (LAY-01)', () => {
  it('covers exactly the roles of the contract', () => {
    expect(Object.keys(widgetIds).sort()).toEqual(Object.keys(catalog.roles).sort());
  });

  it.each(ROLES)('lists the same ids as the contract for %s, in the same order', (role) => {
    expect(widgetIds[role]).toEqual(catalog.roles[role]);
  });

  it('allows the same sizes as the contract', () => {
    expect([...WIDGET_SIZES]).toEqual(catalog.sizes);
  });

  it('caps a layout at the contract limit', () => {
    expect(MAX_WIDGETS).toBe(catalog.maxWidgets);
  });
});

describe('defaultLayoutFor (LAY-02)', () => {
  it.each(ROLES)('holds every widget of %s and no id of another role', (role) => {
    const ids = defaultLayoutFor(role).widgets.map((item) => item.id);

    expect([...ids].sort()).toEqual([...widgetIds[role]].sort());
  });

  it.each(ROLES)('gives %s no repeated id, a valid size on each item and room under the limit', (role) => {
    const { widgets } = defaultLayoutFor(role);

    expect(new Set(widgets.map((item) => item.id)).size).toBe(widgets.length);
    expect(widgets.length).toBeLessThanOrEqual(MAX_WIDGETS);
    for (const item of widgets) expect(WIDGET_SIZES).toContain(item.size);
  });

  it('returns a fresh layout on each call, so a caller cannot change the default', () => {
    const first = defaultLayoutFor('PATIENT');

    expect(defaultLayoutFor('PATIENT')).not.toBe(first);
    expect(defaultLayoutFor('PATIENT')).toEqual(first);
  });
});

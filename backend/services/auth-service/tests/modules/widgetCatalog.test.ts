import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MAX_LAYOUT_WIDGETS,
  USER_ROLE_NAMES,
  WIDGET_IDS_BY_ROLE,
  WIDGET_SIZES,
} from '@glucore/shared';

/**
 * Pins the shared catalog to `contracts/widget-catalog.json`, the file the web
 * reads too. A widget id added on one side only would make the PUT reject a
 * layout the web considers valid, so any divergence has to fail here first.
 */

interface CatalogContract {
  roles: Record<string, string[]>;
  sizes: string[];
  maxWidgets: number;
}

const CONTRACT_PATH = path.resolve(__dirname, '../../../../../contracts/widget-catalog.json');
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as CatalogContract;

describe('widget catalog matches contracts/widget-catalog.json', () => {
  it('declares exactly the three user roles', () => {
    expect(Object.keys(WIDGET_IDS_BY_ROLE).sort()).toEqual([...USER_ROLE_NAMES].sort());
    expect(Object.keys(contract.roles).sort()).toEqual([...USER_ROLE_NAMES].sort());
  });

  it.each(USER_ROLE_NAMES)('has the same %s widget ids, in the same order', (role) => {
    expect(WIDGET_IDS_BY_ROLE[role]).toEqual(contract.roles[role]);
  });

  it('has the same sizes', () => {
    expect(WIDGET_SIZES).toEqual(contract.sizes);
  });

  it('has the same layout limit', () => {
    expect(MAX_LAYOUT_WIDGETS).toBe(contract.maxWidgets);
  });
});

describe('widget catalog matches the spec', () => {
  it('has 16 patient, 11 professional and 11 administrator widgets, none repeated', () => {
    expect(WIDGET_IDS_BY_ROLE.PATIENT).toHaveLength(16);
    expect(WIDGET_IDS_BY_ROLE.HEALTH_PROFESSIONAL).toHaveLength(11);
    expect(WIDGET_IDS_BY_ROLE.ADMINISTRATOR).toHaveLength(11);
    for (const ids of Object.values(WIDGET_IDS_BY_ROLE)) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('allows the sizes S, M and L and at most 20 widgets per layout', () => {
    expect(WIDGET_SIZES).toEqual(['S', 'M', 'L']);
    expect(MAX_LAYOUT_WIDGETS).toBe(20);
  });
});

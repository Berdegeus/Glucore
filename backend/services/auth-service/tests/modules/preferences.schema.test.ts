import { describe, expect, it } from 'vitest';

import { BadRequestError, USER_ROLE_NAMES, WIDGET_IDS_BY_ROLE } from '@glucore/shared';

import { parseLayout } from '../../src/modules/preferences/preferences.schema';

/**
 * LAY-11 and LAY-12: what a saved layout may contain, decided per role, and
 * that the owner never comes from the body.
 */

function expectInvalidLayout(run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BadRequestError);
  expect((caught as BadRequestError).status).toBe(400);
  expect((caught as BadRequestError).code).toBe('INVALID_LAYOUT');
}

describe('parseLayout', () => {
  it('accepts a layout of catalog ids and returns it', () => {
    const widgets = [
      { id: 'kpi-tir', size: 'S' },
      { id: 'chart-agp', size: 'L' },
      { id: 'kpi-gmi', size: 'M' },
    ];
    expect(parseLayout({ widgets }, 'PATIENT')).toEqual({ widgets });
  });

  it.each(USER_ROLE_NAMES)('accepts every catalog id of %s', (role) => {
    const widgets = WIDGET_IDS_BY_ROLE[role].map((id) => ({ id, size: 'M' }));
    expect(parseLayout({ widgets }, role)).toEqual({ widgets });
  });

  it('accepts an empty layout', () => {
    expect(parseLayout({ widgets: [] }, 'PATIENT')).toEqual({ widgets: [] });
  });

  it('rejects an id that is not in any catalog', () => {
    expectInvalidLayout(() =>
      parseLayout({ widgets: [{ id: 'chart-unknown', size: 'M' }] }, 'PATIENT'),
    );
  });

  it("rejects an id from another role's catalog", () => {
    expectInvalidLayout(() =>
      parseLayout({ widgets: [{ id: 'pro-kpi-tir', size: 'M' }] }, 'PATIENT'),
    );
    expectInvalidLayout(() =>
      parseLayout({ widgets: [{ id: 'kpi-tir', size: 'M' }] }, 'HEALTH_PROFESSIONAL'),
    );
  });

  it('rejects a repeated id', () => {
    expectInvalidLayout(() =>
      parseLayout(
        {
          widgets: [
            { id: 'kpi-tir', size: 'S' },
            { id: 'kpi-tir', size: 'M' },
          ],
        },
        'PATIENT',
      ),
    );
  });

  it.each(['XL', 's', '', null, undefined, 2])('rejects size %j', (size) => {
    expectInvalidLayout(() => parseLayout({ widgets: [{ id: 'kpi-tir', size }] }, 'PATIENT'));
  });

  it.each([null, 'kpi-tir', 42, ['kpi-tir', 'M'], { size: 'M' }])(
    'rejects the malformed item %j',
    (item) => {
      expectInvalidLayout(() => parseLayout({ widgets: [item] }, 'PATIENT'));
    },
  );

  describe('the 20-widget limit', () => {
    // No role has more than 16 widgets, so the limit is unreachable without
    // repeating an id; a larger catalog isolates the count rule.
    const ids = Array.from({ length: 21 }, (_, i) => `w-${i}`);
    const catalog = { PATIENT: ids, HEALTH_PROFESSIONAL: [], ADMINISTRATOR: [] };
    const items = (n: number) => ids.slice(0, n).map((id) => ({ id, size: 'S' }));

    it('accepts exactly 20 widgets', () => {
      expect(parseLayout({ widgets: items(20) }, 'PATIENT', catalog).widgets).toHaveLength(20);
    });

    it('rejects 21 widgets', () => {
      expectInvalidLayout(() => parseLayout({ widgets: items(21) }, 'PATIENT', catalog));
    });
  });

  it.each([null, undefined, 'widgets', 7, [{ id: 'kpi-tir', size: 'M' }]])(
    'rejects the non-object body %j',
    (body) => {
      expectInvalidLayout(() => parseLayout(body, 'PATIENT'));
    },
  );

  it.each([undefined, null, 'kpi-tir', { id: 'kpi-tir', size: 'M' }])(
    'rejects widgets = %j',
    (widgets) => {
      expectInvalidLayout(() => parseLayout({ widgets }, 'PATIENT'));
    },
  );

  it('ignores a user id in the body and on the items', () => {
    const parsed = parseLayout(
      {
        userId: 'someone-else',
        widgets: [{ id: 'kpi-tir', size: 'M', userId: 'someone-else' }],
      },
      'PATIENT',
    );
    expect(parsed).toEqual({ widgets: [{ id: 'kpi-tir', size: 'M' }] });
  });
});

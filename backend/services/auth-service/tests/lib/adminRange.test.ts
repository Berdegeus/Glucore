import { describe, expect, it } from 'vitest';

import { parseAdminRangeDays } from '@glucore/shared';

/** ADM-02: the periods the admin overview accepts, shared by gateway and both services. */

describe('parseAdminRangeDays', () => {
  it('defaults to 30 when days is absent', () => {
    expect(parseAdminRangeDays(undefined)).toBe(30);
  });

  it.each([
    ['7', 7],
    ['30', 30],
    ['90', 90],
    [' 90 ', 90],
    [7, 7],
  ])('accepts %j', (input, expected) => {
    expect(parseAdminRangeDays(input)).toBe(expected);
  });

  it.each(['0', '6', '8', '29', '31', '89', '91', '', 'abc', '30abc', '-7', '7.5', 14, 0, NaN, null, ['7', '30']])(
    'rejects %j with 400 INVALID_DASHBOARD_RANGE',
    (input) => {
      let caught: { status: number; code: string; message: string } | undefined;
      try {
        parseAdminRangeDays(input);
      } catch (error) {
        caught = error as typeof caught;
      }
      expect(caught).toMatchObject({
        status: 400,
        code: 'INVALID_DASHBOARD_RANGE',
        message: 'days must be one of 7, 30, 90',
      });
    },
  );
});

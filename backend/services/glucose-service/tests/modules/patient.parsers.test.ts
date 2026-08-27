import { describe, expect, it } from 'vitest';

import {
  parseOptionalDate,
  parseOptionalInt,
  parseOptionalNumber,
} from '../../src/modules/patient/patient.parsers';

/**
 * The three parsers share one convention — undefined means "absent or
 * unusable", null means "explicitly cleared" — and every profile field is
 * validated against it, so the branches are worth covering exhaustively.
 */

describe('parseOptionalDate', () => {
  const cases: Array<[string, unknown, string | null | undefined]> = [
    ['ISO date', '2026-08-25', '2026-08-25T00:00:00.000Z'],
    ['Brazilian date, the format the app sends', '25/08/2026', '2026-08-25T00:00:00.000Z'],
    ['leap day in a leap year', '29/02/2024', '2024-02-29T00:00:00.000Z'],
    ['ISO with surrounding blanks', '  2026-08-25  ', '2026-08-25T00:00:00.000Z'],
    ['absent', undefined, undefined],
    ['explicit null clears the field', null, null],
    ['empty string clears the field', '', null],
    ['blanks only clear the field', '   ', null],
    ['ISO day that rolls over', '2026-02-30', undefined],
    ['Brazilian day that rolls over', '31/02/2026', undefined],
    ['leap day in a common year', '29/02/2026', undefined],
    ['not a date at all', 'nope', undefined],
  ];

  it.each(cases)('%s', (_label, input, expected) => {
    const parsed = parseOptionalDate(input);
    if (expected === undefined || expected === null) {
      expect(parsed).toBe(expected);
    } else {
      expect((parsed as Date).toISOString()).toBe(expected);
    }
  });

  it('falls back to Date parsing for a full timestamp', () => {
    const parsed = parseOptionalDate('2026-08-25T13:45:00.000Z');
    expect((parsed as Date).toISOString()).toBe('2026-08-25T13:45:00.000Z');
  });

  it('reads both written forms of the same day as the same instant', () => {
    expect((parseOptionalDate('2026-08-25') as Date).getTime()).toBe(
      (parseOptionalDate('25/08/2026') as Date).getTime(),
    );
  });
});

describe('parseOptionalNumber', () => {
  const cases: Array<[string, unknown, number | null | undefined]> = [
    ['a number', 72.5, 72.5],
    ['a numeric string', '72.5', 72.5],
    ['zero', 0, 0],
    ['absent', undefined, undefined],
    ['explicit null clears the field', null, null],
    ['empty string clears the field', '', null],
    ['not a number', 'heavy', undefined],
    ['infinity', Infinity, undefined],
  ];

  it.each(cases)('%s', (_label, input, expected) => {
    expect(parseOptionalNumber(input)).toBe(expected);
  });
});

describe('parseOptionalInt', () => {
  const cases: Array<[string, unknown, number | undefined]> = [
    ['an integer', 90, 90],
    ['an integer as a string', '90', 90],
    ['absent', undefined, undefined],
    // No null case: a target range has no cleared state, so a blank leaves the
    // stored value alone rather than erasing it.
    ['null', null, undefined],
    ['empty string', '', undefined],
    ['a fraction is not an integer', 90.5, undefined],
    ['not a number', 'ninety', undefined],
  ];

  it.each(cases)('%s', (_label, input, expected) => {
    expect(parseOptionalInt(input)).toBe(expected);
  });
});

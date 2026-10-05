import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  formatDate,
  formatDateTime,
  formatMgdl,
  formatNumber,
  formatPercent,
  formatTime,
} from './format';

const SAO_PAULO = 'America/Sao_Paulo';
const NBSP = '\u00a0';
// 17:30 UTC is 14:30 in Sao Paulo (UTC-3).
const AFTERNOON = '2026-08-05T17:30:00.000Z';
// 02:30 UTC is still the evening of the 4th in Sao Paulo.
const SMALL_HOURS = '2026-08-05T02:30:00.000Z';

describe('numbers (RSP-09)', () => {
  it('uses the decimal comma', () => {
    expect(formatNumber(1234.5)).toBe('1234,5');
  });

  it.each<[number, number, string]>([
    [0, 1, '0,0'],
    [7, 0, '7'],
    [2.345, 2, '2,35'],
    [-3.5, 1, '-3,5'],
  ])('formats %s with %s decimals as %s', (value, digits, expected) => {
    expect(formatNumber(value, digits)).toBe(expected);
  });

  it('shows a percentage with a space before the sign', () => {
    expect(formatPercent(70)).toBe(`70,0${NBSP}%`);
    expect(formatPercent(0)).toBe(`0,0${NBSP}%`);
    expect(formatPercent(33.333, 2)).toBe(`33,33${NBSP}%`);
  });

  it('shows glucose in whole mg/dL', () => {
    expect(formatMgdl(142)).toBe(`142${NBSP}mg/dL`);
    expect(formatMgdl(141.6)).toBe(`142${NBSP}mg/dL`);
    expect(formatMgdl(0)).toBe(`0${NBSP}mg/dL`);
  });
});

describe('dates and times in the given zone (RSP-09)', () => {
  it('formats the day as dd/mm/yyyy', () => {
    expect(formatDate(AFTERNOON, SAO_PAULO)).toBe('05/08/2026');
  });

  it('formats the time on a 24 hour clock in the zone', () => {
    expect(formatTime(AFTERNOON, SAO_PAULO)).toBe('14:30');
    expect(formatTime(AFTERNOON, 'UTC')).toBe('17:30');
  });

  it('reads midnight as 00, not 24', () => {
    expect(formatTime('2026-08-05T03:00:00.000Z', SAO_PAULO)).toBe('00:00');
  });

  it('moves the calendar day with the zone', () => {
    expect(formatDate(SMALL_HOURS, SAO_PAULO)).toBe('04/08/2026');
    expect(formatDate(SMALL_HOURS, 'UTC')).toBe('05/08/2026');
  });

  it('accepts a Date and joins date and time', () => {
    expect(formatDateTime(new Date(AFTERNOON), SAO_PAULO)).toBe('05/08/2026 14:30');
  });
});

describe('missing values', () => {
  it('shows a dash for null, undefined and non-finite numbers', () => {
    expect(EMPTY_VALUE).toBe('—');
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatNumber(value)).toBe('—');
      expect(formatPercent(value)).toBe('—');
      expect(formatMgdl(value)).toBe('—');
    }
  });

  it('shows a dash for a missing or invalid instant', () => {
    for (const value of [null, undefined, 'not a date']) {
      expect(formatDate(value, SAO_PAULO)).toBe('—');
      expect(formatTime(value, SAO_PAULO)).toBe('—');
      expect(formatDateTime(value, SAO_PAULO)).toBe('—');
    }
  });
});

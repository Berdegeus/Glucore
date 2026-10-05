import { describe, expect, it } from 'vitest';

import { parseCohortQuery, parsePatientListQuery } from '../../src/modules/professional/professional.schema';

/** PRO-16 (50 by default, 200 at most) and the portfolio periods (7, 14, 30, 90 days). */

describe('parsePatientListQuery', () => {
  it('defaults to the first page of 50 over 14 days in UTC', () => {
    expect(parsePatientListQuery({})).toEqual({ days: 14, tz: 'UTC', page: 1, limit: 50 });
  });

  it.each([1, 50, 199, 200])('accepts limit %i', (limit) => {
    expect(parsePatientListQuery({ limit: String(limit) }).limit).toBe(limit);
  });

  it.each(['0', '201', '-1', '1.5', 'abc', ''])('rejects limit "%s" with INVALID_PAGINATION', (limit) => {
    expect(() => parsePatientListQuery({ limit })).toThrow(expect.objectContaining({ code: 'INVALID_PAGINATION' }));
  });

  it.each(['0', '-1', '1.5', 'abc'])('rejects page "%s" with INVALID_PAGINATION', (page) => {
    expect(() => parsePatientListQuery({ page })).toThrow(expect.objectContaining({ code: 'INVALID_PAGINATION' }));
  });

  it('reads page, days and tz together', () => {
    expect(parsePatientListQuery({ page: '3', limit: '10', days: '90', tz: 'America/Sao_Paulo' })).toEqual({
      days: 90,
      tz: 'America/Sao_Paulo',
      page: 3,
      limit: 10,
    });
  });
});

describe('parseCohortQuery', () => {
  it.each([7, 14, 30, 90])('accepts days=%i', (days) => {
    expect(parseCohortQuery({ days: String(days) }).days).toBe(days);
  });

  it.each(['6', '8', '13', '15', '29', '31', '89', '91', '0', '-7', 'abc', ''])(
    'rejects days "%s" with INVALID_DASHBOARD_RANGE',
    (days) => {
      expect(() => parseCohortQuery({ days })).toThrow(expect.objectContaining({ code: 'INVALID_DASHBOARD_RANGE' }));
    },
  );

  it.each([['a b'], ['x'.repeat(65)], [42]])('rejects a malformed tz %j with INVALID_TIMEZONE', (tz) => {
    expect(() => parseCohortQuery({ tz })).toThrow(expect.objectContaining({ code: 'INVALID_TIMEZONE' }));
  });
});

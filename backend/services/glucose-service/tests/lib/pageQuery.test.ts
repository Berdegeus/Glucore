import { describe, expect, it } from 'vitest';

import {
  BadRequestError,
  DEFAULT_PAGE_LIMIT,
  INVALID_PAGINATION,
  MAX_PAGE_LIMIT,
  parsePageQuery,
} from '@glucore/shared';

describe('parsePageQuery', () => {
  it('defaults to the 100 most recent rows when nothing is sent', () => {
    expect(parsePageQuery({})).toEqual({ limit: DEFAULT_PAGE_LIMIT });
  });

  it('accepts a bare limit within range', () => {
    expect(parsePageQuery({ limit: 40 })).toEqual({ limit: 40 });
  });

  it('accepts limit at each boundary', () => {
    expect(parsePageQuery({ limit: 1 })).toEqual({ limit: 1 });
    expect(parsePageQuery({ limit: MAX_PAGE_LIMIT })).toEqual({ limit: MAX_PAGE_LIMIT });
  });

  it('accepts a numeric-string limit from the query string', () => {
    expect(parsePageQuery({ limit: '250' })).toEqual({ limit: 250 });
  });

  it('rejects a limit above the maximum, with the INVALID_PAGINATION code', () => {
    expect(() => parsePageQuery({ limit: MAX_PAGE_LIMIT + 1 })).toThrow(BadRequestError);
    try {
      parsePageQuery({ limit: MAX_PAGE_LIMIT + 1 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).code).toBe(INVALID_PAGINATION);
    }
  });

  it('rejects limit below 1', () => {
    expect(() => parsePageQuery({ limit: 0 })).toThrow(BadRequestError);
  });

  it('rejects a non-numeric limit', () => {
    expect(() => parsePageQuery({ limit: 'lots' })).toThrow(BadRequestError);
  });

  it('accepts before as an epoch-ms cursor', () => {
    expect(parsePageQuery({ before: 1_700_000_000_000 })).toEqual({
      before: 1_700_000_000_000,
      limit: DEFAULT_PAGE_LIMIT,
    });
  });

  it('accepts before and limit together', () => {
    expect(parsePageQuery({ before: 1000, limit: 5 })).toEqual({ before: 1000, limit: 5 });
  });

  it('rejects a negative before', () => {
    expect(() => parsePageQuery({ before: -1 })).toThrow(BadRequestError);
  });

  it('rejects a non-numeric before, with the INVALID_PAGINATION code', () => {
    try {
      parsePageQuery({ before: 'yesterday' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).code).toBe(INVALID_PAGINATION);
    }
  });

  it('accepts before as a numeric string', () => {
    expect(parsePageQuery({ before: '1000' })).toEqual({ before: 1000, limit: DEFAULT_PAGE_LIMIT });
  });
});

describe('parsePageQuery with options', () => {
  const readings = { defaultLimit: 5000, maxLimit: 5000, from: true };

  it('uses the default limit it was given', () => {
    expect(parsePageQuery({}, readings)).toEqual({ limit: 5000 });
  });

  it('raises the ceiling to the one it was given and no further', () => {
    expect(parsePageQuery({ limit: 5000 }, readings)).toEqual({ limit: 5000 });
    expect(() => parsePageQuery({ limit: 5001 }, readings)).toThrow(
      'limit must be an integer between 1 and 5000',
    );
  });

  it('reads from as an inclusive epoch-ms bound only when asked to', () => {
    expect(parsePageQuery({ from: '1000', before: '2000' }, readings)).toEqual({
      from: 1000,
      before: 2000,
      limit: 5000,
    });
    expect(parsePageQuery({ from: '1000' })).toEqual({ limit: DEFAULT_PAGE_LIMIT });
  });

  it.each(['-1', 'yesterday', '1.5'])('rejects from=%s with INVALID_PAGINATION', (from) => {
    try {
      parsePageQuery({ from }, readings);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).code).toBe(INVALID_PAGINATION);
    }
  });
});

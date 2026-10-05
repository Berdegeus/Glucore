import { describe, expect, it } from 'vitest';

import { parseUserListQuery } from '../../src/modules/admin/admin.schema';

/** ADM-04: the account list's query contract, with its exact codes and bounds. */

function rejection(query: Record<string, unknown>) {
  try {
    parseUserListQuery(query);
  } catch (error) {
    return error as { status: number; code: string };
  }
  throw new Error('expected the query to be rejected');
}

describe('parseUserListQuery', () => {
  it('defaults to page 1, 25 per page and no filter', () => {
    expect(parseUserListQuery({})).toEqual({ page: 1, limit: 25 });
  });

  it('reads valid filters and trims the search text', () => {
    expect(
      parseUserListQuery({ role: 'HEALTH_PROFESSIONAL', status: 'BLOCKED', q: '  ana ', page: '2', limit: '50' }),
    ).toEqual({ role: 'HEALTH_PROFESSIONAL', status: 'BLOCKED', q: 'ana', page: 2, limit: 50 });
  });

  it.each([
    { role: 'DOCTOR' },
    { role: 'patient' },
    { role: ['PATIENT', 'ADMINISTRATOR'] },
    { status: 'DELETED' },
    { status: '' },
    { q: ['a', 'b'] },
  ])('rejects %j with 400 INVALID_FILTER', (query) => {
    expect(rejection(query)).toMatchObject({ status: 400, code: 'INVALID_FILTER' });
  });

  it.each([{ page: '0' }, { page: '-1' }, { page: 'abc' }, { page: '1.5' }, { limit: '0' }, { limit: '101' }, { limit: 'x' }])(
    'rejects %j with 400 INVALID_PAGINATION',
    (query) => {
      expect(rejection(query)).toMatchObject({ status: 400, code: 'INVALID_PAGINATION' });
    },
  );

  it('accepts the bounds: page 1, limit 1 and limit 100', () => {
    expect(parseUserListQuery({ page: '1', limit: '1' })).toMatchObject({ page: 1, limit: 1 });
    expect(parseUserListQuery({ limit: '100' })).toMatchObject({ limit: 100 });
    expect(parseUserListQuery({ limit: '99' })).toMatchObject({ limit: 99 });
  });
});

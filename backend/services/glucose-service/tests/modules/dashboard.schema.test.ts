import { BadRequestError } from '@glucore/shared';
import { describe, expect, it } from 'vitest';

import { parseDashboardQuery } from '../../src/modules/dashboard/dashboard.schema';

/** Runs the parser and hands back the thrown error, failing the test when nothing is thrown. */
function rejection(query: Parameters<typeof parseDashboardQuery>[0]): BadRequestError {
  try {
    parseDashboardQuery(query);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestError);
    return error as BadRequestError;
  }
  throw new Error('expected parseDashboardQuery to throw');
}

describe('parseDashboardQuery — tz', () => {
  it('defaults to UTC when tz is omitted', () => {
    expect(parseDashboardQuery({}).tz).toBe('UTC');
  });

  it.each(['UTC', 'America/Sao_Paulo', 'Etc/GMT+3', 'America/Port-au-Prince', 'America/Argentina/Buenos_Aires'])(
    'keeps a well-formed IANA name as sent: %s',
    (tz) => {
      expect(parseDashboardQuery({ tz }).tz).toBe(tz);
    },
  );

  it('accepts a name exactly 64 characters long', () => {
    const tz = 'A'.repeat(64);
    expect(parseDashboardQuery({ tz }).tz).toBe(tz);
  });

  it.each([
    ['one character over the 64 limit', 'A'.repeat(65)],
    ['empty', ''],
    ['a space', 'America/Sao Paulo'],
    ['a SQL fragment', "UTC'; DROP TABLE x;--"],
    ['a non-ASCII letter', 'América/São_Paulo'],
    ['a repeated parameter (array)', ['UTC', 'America/Sao_Paulo']],
    ['a nested object', { name: 'UTC' }],
  ])('rejects a tz that is %s with 400 INVALID_TIMEZONE', (_label, tz) => {
    const error = rejection({ tz });

    expect(error.status).toBe(400);
    expect(error.code).toBe('INVALID_TIMEZONE');
  });
});

describe('parseDashboardQuery — period rules stay as they were', () => {
  it('defaults to the 14 days ending today', () => {
    const { from, to } = parseDashboardQuery({});
    expect((to.getTime() - from.getTime()) / 86_400_000).toBe(14);
  });

  it('accepts a span of exactly 90 days and rejects 91', () => {
    expect(() => parseDashboardQuery({ from: '2026-01-01', to: '2026-04-01' })).not.toThrow();
    expect(rejection({ from: '2026-01-01', to: '2026-04-02' }).code).toBe('INVALID_DASHBOARD_RANGE');
  });

  it('rejects from after to', () => {
    expect(rejection({ from: '2026-08-10', to: '2026-08-01' }).code).toBe('INVALID_DASHBOARD_RANGE');
  });

  it('rejects a bucket other than day', () => {
    expect(rejection({ bucket: 'hour' }).code).toBe('INVALID_DASHBOARD_RANGE');
  });

  it('rejects a malformed date', () => {
    expect(rejection({ from: '08/01/2026' }).code).toBe('INVALID_DASHBOARD_RANGE');
  });
});

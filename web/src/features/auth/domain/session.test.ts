import { describe, expect, it } from 'vitest';
import type { Role } from '../../../shared/domain/role';
import type { Account } from './account';
import { REFRESH_WINDOW_MS, needsRefresh, type Session } from './session';

const NOW = new Date('2026-05-03T12:00:00.000Z');

function sessionOf(role: Role, msLeft: number | null): Session {
  const account: Account = {
    id: 'u1',
    email: 'ana@example.com',
    fullName: 'Ana Souza',
    phone: null,
    status: 'ACTIVE',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  return { account, expiresAt: msLeft === null ? null : new Date(NOW.getTime() + msLeft) };
}

const FIVE_MIN = REFRESH_WINDOW_MS;

describe('needsRefresh (ACC-10)', () => {
  it('uses a 5 minute window', () => {
    expect(REFRESH_WINDOW_MS).toBe(300_000);
  });

  it.each<[Role, boolean]>([
    ['PATIENT', false],
    ['HEALTH_PROFESSIONAL', true],
    ['ADMINISTRATOR', true],
  ])('with %s close to expiry and recently active, renews: %s', (role, expected) => {
    expect(needsRefresh(sessionOf(role, 60_000), NOW, true)).toBe(expected);
  });

  it.each<[string, number, boolean]>([
    ['5:00 left', FIVE_MIN, false],
    ['4:59 left', FIVE_MIN - 1000, true],
    ['4:59.999 left', FIVE_MIN - 1, true],
    ['5:00.001 left', FIVE_MIN + 1, false],
    ['an hour left', 60 * 60 * 1000, false],
  ])('a professional with %s renews: %s', (_label, msLeft, expected) => {
    expect(needsRefresh(sessionOf('HEALTH_PROFESSIONAL', msLeft), NOW, true)).toBe(expected);
  });

  it('does not renew without recent activity, even near expiry', () => {
    expect(needsRefresh(sessionOf('HEALTH_PROFESSIONAL', 60_000), NOW, false)).toBe(false);
  });

  it('does not renew when the expiry is unknown', () => {
    expect(needsRefresh(sessionOf('ADMINISTRATOR', null), NOW, true)).toBe(false);
  });
});

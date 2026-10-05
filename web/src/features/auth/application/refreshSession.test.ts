import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import type { Role } from '../../../shared/domain/role';
import { accountOf, memoryTokenStore } from '../../../test/authFakes';
import type { Session } from '../domain/session';
import { createRefreshSession } from './refreshSession';

const NOW = new Date('2026-05-03T12:00:00.000Z');
const NEW_EXPIRY = new Date('2026-05-03T12:30:00.000Z');
const inMs = (ms: number) => new Date(NOW.getTime() + ms);

function setup(role: Role, msLeft: number) {
  const tokenStore = memoryTokenStore('old-token');
  const sessions = { login: vi.fn(), refresh: vi.fn().mockResolvedValue('new-token') };
  const expiryReader = { expiresAt: vi.fn().mockReturnValue(NEW_EXPIRY) };
  const refresh = createRefreshSession({ sessions, tokenStore, expiryReader, clock: { now: () => NOW } });
  const session: Session = { account: accountOf(role), expiresAt: inMs(msLeft) };
  return { refresh, session, sessions, tokenStore, expiryReader };
}

describe('createRefreshSession (ACC-10)', () => {
  it('never renews a patient session, even close to expiry', async () => {
    const { refresh, session, sessions, tokenStore } = setup('PATIENT', 60_000);

    expect(await refresh({ session, hadRecentActivity: true })).toBe(session);

    expect(sessions.refresh).not.toHaveBeenCalled();
    expect(tokenStore.read()).toBe('old-token');
  });

  it.each<Role>(['HEALTH_PROFESSIONAL', 'ADMINISTRATOR'])(
    'renews a %s session close to expiry and swaps the token',
    async (role) => {
      const { refresh, session, sessions, tokenStore, expiryReader } = setup(role, 4 * 60_000);

      const renewed = await refresh({ session, hadRecentActivity: true });

      expect(sessions.refresh).toHaveBeenCalledTimes(1);
      expect(tokenStore.read()).toBe('new-token');
      expect(expiryReader.expiresAt).toHaveBeenCalledWith('new-token');
      expect(renewed).toEqual({ account: session.account, expiresAt: NEW_EXPIRY });
    },
  );

  it.each([
    ['has 5 minutes or more left', 5 * 60_000, true],
    ['has been inactive', 60_000, false],
  ])('does not renew a professional who %s', async (_label, msLeft, hadRecentActivity) => {
    const { refresh, session, sessions, tokenStore } = setup('HEALTH_PROFESSIONAL', msLeft);

    expect(await refresh({ session, hadRecentActivity })).toBe(session);

    expect(sessions.refresh).not.toHaveBeenCalled();
    expect(tokenStore.read()).toBe('old-token');
  });

  it('propagates an unauthenticated failure and keeps the stored token untouched', async () => {
    const { refresh, session, sessions, tokenStore } = setup('ADMINISTRATOR', 60_000);
    sessions.refresh.mockRejectedValue(new AppError('unauthenticated', { code: 'TOKEN_INVALID' }));

    await expect(refresh({ session, hadRecentActivity: true })).rejects.toMatchObject({ kind: 'unauthenticated' });

    expect(tokenStore.read()).toBe('old-token');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { AppError, type AppErrorKind } from '../../../shared/domain/appError';
import { accountOf, memoryTokenStore } from '../../../test/authFakes';
import { createRestoreSession } from './restoreSession';

const NOW = new Date('2026-05-03T12:00:00.000Z');

function setup({ token = 'tok-1' as string | null, expiresAt = null as Date | null } = {}) {
  const tokenStore = memoryTokenStore(token);
  const accounts = { current: vi.fn().mockResolvedValue(accountOf('ADMINISTRATOR')) };
  const expiryReader = { expiresAt: vi.fn().mockReturnValue(expiresAt) };
  const restore = createRestoreSession({ accounts, expiryReader, tokenStore, clock: { now: () => NOW } });
  return { restore, tokenStore, accounts, expiryReader };
}

const inMs = (ms: number) => new Date(NOW.getTime() + ms);

describe('createRestoreSession (ACC-01, ACC-04)', () => {
  it('is anonymous without a stored token and never calls /me', async () => {
    const { restore, accounts, expiryReader } = setup({ token: null });

    expect(await restore()).toBeNull();

    expect(accounts.current).not.toHaveBeenCalled();
    expect(expiryReader.expiresAt).not.toHaveBeenCalled();
  });

  it('returns the session of a valid token, keeping the token', async () => {
    const { restore, tokenStore } = setup({ expiresAt: inMs(1000) });

    const session = await restore();

    expect(session?.account.role).toBe('ADMINISTRATOR');
    expect(session?.expiresAt).toEqual(inMs(1000));
    expect(tokenStore.read()).toBe('tok-1');
  });

  it.each([
    ['one second after expiry', -1000],
    ['the exact expiry instant', 0],
  ])('discards a token %s without calling /me', async (_label, msFromNow) => {
    const { restore, tokenStore, accounts } = setup({ expiresAt: inMs(msFromNow) });

    expect(await restore()).toBeNull();

    expect(tokenStore.read()).toBeNull();
    expect(accounts.current).not.toHaveBeenCalled();
  });

  it('asks /me when the token carries no readable expiry', async () => {
    const { restore, accounts } = setup({ expiresAt: null });

    expect(await restore()).not.toBeNull();

    expect(accounts.current).toHaveBeenCalledTimes(1);
  });

  it.each<AppErrorKind>(['unauthenticated', 'invalid-credentials'])(
    'clears the token and is anonymous when /me answers 401 (%s)',
    async (kind) => {
      const { restore, tokenStore, accounts } = setup({ expiresAt: inMs(60_000) });
      accounts.current.mockRejectedValue(new AppError(kind));

      expect(await restore()).toBeNull();

      expect(tokenStore.read()).toBeNull();
    },
  );

  it('rethrows other failures and keeps the token', async () => {
    const { restore, tokenStore, accounts } = setup({ expiresAt: inMs(60_000) });
    accounts.current.mockRejectedValue(new AppError('unavailable'));

    await expect(restore()).rejects.toMatchObject({ kind: 'unavailable' });

    expect(tokenStore.read()).toBe('tok-1');
  });
});

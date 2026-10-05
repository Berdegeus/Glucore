import { describe, expect, it, vi } from 'vitest';
import { accountOf, memoryTokenStore } from '../../../test/authFakes';
import { AppError } from '../../../shared/domain/appError';
import type { Role } from '../../../shared/domain/role';
import type { Account } from '../domain/account';
import { createLogin } from './login';

const CREDENTIALS = { email: 'ana@example.com', password: 'Senha123!' };
const EXPIRY = new Date('2026-05-03T12:00:00.000Z');

function setup(account: Account | AppError = accountOf('HEALTH_PROFESSIONAL')) {
  const tokenStore = memoryTokenStore();
  const sessions = { login: vi.fn().mockResolvedValue('tok-1'), refresh: vi.fn() };
  const accounts = {
    // `/me` only works with the token already stored, as with the real client.
    current: vi.fn(() => {
      if (tokenStore.read() !== 'tok-1') return Promise.reject(new AppError('unauthenticated'));
      return account instanceof AppError ? Promise.reject(account) : Promise.resolve(account);
    }),
  };
  const sessionEvents = { emitExpired: vi.fn(), subscribe: vi.fn(), reset: vi.fn() };
  const expiryReader = { expiresAt: vi.fn().mockReturnValue(EXPIRY) };
  const login = createLogin({ sessions, accounts, tokenStore, sessionEvents, expiryReader });
  return { login, tokenStore, sessions, accounts, sessionEvents, expiryReader };
}

describe('createLogin (ACC-01, ACC-07)', () => {
  it('stores the token and returns the session with the role read from /me', async () => {
    const { login, tokenStore, sessions, expiryReader } = setup(accountOf('HEALTH_PROFESSIONAL'));

    const session = await login(CREDENTIALS);

    expect(sessions.login).toHaveBeenCalledWith(CREDENTIALS);
    expect(tokenStore.read()).toBe('tok-1');
    expect(session.account.role).toBe('HEALTH_PROFESSIONAL');
    expect(expiryReader.expiresAt).toHaveBeenCalledWith('tok-1');
    expect(session.expiresAt).toEqual(EXPIRY);
  });

  it.each<Role>(['PATIENT', 'HEALTH_PROFESSIONAL', 'ADMINISTRATOR'])('accepts the %s role', async (role) => {
    const { login } = setup(accountOf(role));

    expect((await login(CREDENTIALS)).account.role).toBe(role);
  });

  it('re-arms the session expiry notice after a successful login (ACC-09)', async () => {
    const { login, sessionEvents } = setup();

    await login(CREDENTIALS);

    expect(sessionEvents.reset).toHaveBeenCalledTimes(1);
  });

  it('propagates invalid-credentials without storing a token or reading /me', async () => {
    const { login, tokenStore, sessions, accounts, sessionEvents } = setup();
    sessions.login.mockRejectedValue(new AppError('invalid-credentials'));

    await expect(login(CREDENTIALS)).rejects.toMatchObject({ kind: 'invalid-credentials' });

    expect(tokenStore.read()).toBeNull();
    expect(accounts.current).not.toHaveBeenCalled();
    expect(sessionEvents.reset).not.toHaveBeenCalled();
  });

  it('removes the token when /me fails', async () => {
    const { login, tokenStore, sessionEvents } = setup(new AppError('unavailable'));

    await expect(login(CREDENTIALS)).rejects.toMatchObject({ kind: 'unavailable' });

    expect(tokenStore.read()).toBeNull();
    expect(sessionEvents.reset).not.toHaveBeenCalled();
  });

  it('rejects an unknown role and removes the token', async () => {
    const { login, tokenStore } = setup({ ...accountOf(), role: 'NURSE' as Role });

    await expect(login(CREDENTIALS)).rejects.toMatchObject({ kind: 'unknown', code: 'UNKNOWN_ROLE' });

    expect(tokenStore.read()).toBeNull();
  });
});

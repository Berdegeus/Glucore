import { AppError } from '../../../shared/domain/appError';
import { isRole } from '../../../shared/domain/role';
import type { AccountRepository, TokenExpiryReader } from '../domain/ports';
import type { Session } from '../domain/session';

export interface ResolveSessionDeps {
  accounts: AccountRepository;
  expiryReader: TokenExpiryReader;
}

/**
 * Builds the session for the token the store already holds: `/me` gives the
 * account and its role, the token's `exp` gives the expiry. A role outside the
 * three known ones is rejected, so no page ever opens for it (ACC-01).
 */
export async function resolveSession(token: string, deps: ResolveSessionDeps): Promise<Session> {
  const account = await deps.accounts.current();
  if (!isRole(account.role)) throw new AppError('unknown', { code: 'UNKNOWN_ROLE' });
  return { account, expiresAt: deps.expiryReader.expiresAt(token) };
}

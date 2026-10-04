import type { Clock, TokenStore } from '../../../shared/domain/ports';
import type { SessionRepository, TokenExpiryReader } from '../domain/ports';
import { needsRefresh, type Session } from '../domain/session';

export interface RefreshSessionDeps {
  sessions: SessionRepository;
  tokenStore: TokenStore;
  expiryReader: TokenExpiryReader;
  clock: Clock;
}

export interface RefreshInput {
  session: Session;
  /** Whether the person used the page in the last 5 minutes. */
  hadRecentActivity: boolean;
}

export type RefreshSession = (input: RefreshInput) => Promise<Session>;

/**
 * Renews the token with `POST /auth/refresh` when `needsRefresh` says so (ACC-10)
 * and returns the session with its new expiry; otherwise returns it untouched.
 * A failure propagates as is: a refused token is `unauthenticated`, and the HTTP
 * client has already ended the session by then.
 */
export function createRefreshSession(deps: RefreshSessionDeps): RefreshSession {
  return async ({ session, hadRecentActivity }) => {
    if (!needsRefresh(session, deps.clock.now(), hadRecentActivity)) return session;
    const token = await deps.sessions.refresh();
    deps.tokenStore.save(token);
    return { ...session, expiresAt: deps.expiryReader.expiresAt(token) };
  };
}

import type { SessionEvents, TokenStore } from '../../../shared/domain/ports';
import type { Credentials, SessionRepository } from '../domain/ports';
import type { Session } from '../domain/session';
import { resolveSession, type ResolveSessionDeps } from './resolveSession';

export interface LoginDeps extends ResolveSessionDeps {
  sessions: SessionRepository;
  tokenStore: TokenStore;
  sessionEvents: SessionEvents;
}

export type Login = (credentials: Credentials) => Promise<Session>;

/**
 * Signs in (ACC-01): `POST /auth/login`, store the token, read the role in
 * `/me`. A failure after the token is stored removes it again, so a half
 * finished login never leaves a session behind. A wrong password rejects with
 * `invalid-credentials` before anything is stored (ACC-07).
 */
export function createLogin(deps: LoginDeps): Login {
  return async (credentials) => {
    const token = await deps.sessions.login(credentials);
    deps.tokenStore.save(token);
    try {
      const session = await resolveSession(token, deps);
      // A new login re-arms the expiry notice for the next session (ACC-09).
      deps.sessionEvents.reset();
      return session;
    } catch (error) {
      deps.tokenStore.clear();
      throw error;
    }
  };
}

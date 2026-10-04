import { isAppError, type AppErrorKind } from '../../../shared/domain/appError';
import type { Clock, TokenStore } from '../../../shared/domain/ports';
import type { Session } from '../domain/session';
import { resolveSession, type ResolveSessionDeps } from './resolveSession';

export interface RestoreSessionDeps extends ResolveSessionDeps {
  tokenStore: TokenStore;
  clock: Clock;
}

export type RestoreSession = () => Promise<Session | null>;

/** The API refused the token: the person is signed out, not offline. */
const REFUSED_TOKEN: readonly AppErrorKind[] = ['unauthenticated', 'invalid-credentials'];

/**
 * Brings back the session of a reloaded tab (ACC-01, ACC-04). No token, an
 * expired one, or a `401` from `/me` all end as anonymous (`null`) with the
 * token cleared. Any other failure, such as the gateway being down, rethrows
 * and keeps the token: a network error must not sign anyone out.
 */
export function createRestoreSession(deps: RestoreSessionDeps): RestoreSession {
  return async () => {
    const token = deps.tokenStore.read();
    if (!token) return null;
    const expiresAt = deps.expiryReader.expiresAt(token);
    if (expiresAt && expiresAt.getTime() <= deps.clock.now().getTime()) {
      deps.tokenStore.clear();
      return null;
    }
    try {
      return await resolveSession(token, deps);
    } catch (error) {
      if (!isAppError(error) || !REFUSED_TOKEN.includes(error.kind)) throw error;
      deps.tokenStore.clear();
      return null;
    }
  };
}

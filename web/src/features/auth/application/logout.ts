import type { TokenStore } from '../../../shared/domain/ports';

/** Drops in-memory data tied to the signed-in person, e.g. the query cache. */
export type SessionCleaner = () => void;

export interface LogoutDeps {
  tokenStore: TokenStore;
  /**
   * Read at call time, so a cleaner registered after the use case was created
   * (the query cache is built by the UI) still runs.
   */
  cleaners: ReadonlySet<SessionCleaner>;
}

export type Logout = () => void;

/** Signs out (ACC-11): the token goes first, then every registered cleaner runs once. */
export function createLogout(deps: LogoutDeps): Logout {
  return () => {
    deps.tokenStore.clear();
    for (const clean of deps.cleaners) clean();
  };
}

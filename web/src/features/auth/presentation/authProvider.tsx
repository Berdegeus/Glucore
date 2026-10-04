import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SessionEvents, Unsubscribe } from '../../../shared/domain/ports';
import type { Login } from '../application/login';
import type { Logout, SessionCleaner } from '../application/logout';
import type { RestoreSession } from '../application/restoreSession';
import type { Credentials } from '../domain/ports';
import type { Session } from '../domain/session';

export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente.';

/** What the provider needs from the container; the container's own shape satisfies it. */
export interface AuthServices {
  login: Login;
  restoreSession: RestoreSession;
  logout: Logout;
  sessionEvents: SessionEvents;
  registerSessionCleaner(cleaner: SessionCleaner): Unsubscribe;
}

export type AuthState =
  /** Reading the stored token and asking `/me` who it belongs to. */
  | { status: 'restoring' }
  /** The restore failed for a reason other than a refused token, e.g. the gateway is down. */
  | { status: 'failed'; error: unknown }
  /** `notice` is set when the session ended on its own (ACC-09). */
  | { status: 'anonymous'; notice: string | null }
  | { status: 'authenticated'; session: Session };

export interface AuthContextValue {
  state: AuthState;
  login(credentials: Credentials): Promise<void>;
  logout(): void;
  /** Asks again after a failed restore. */
  retryRestore(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ANONYMOUS: AuthState = { status: 'anonymous', notice: null };

/**
 * Holds who is signed in. It restores the session on mount, signs in and out
 * through the use cases, and listens for the end of the session (ACC-09). Every
 * way out of a session, `logout` or expiry, runs the use case's cleaners, and
 * the provider registers the query cache as one, so the next person at the same
 * browser never sees the previous one's data (ACC-11).
 */
export function AuthProvider({ services, children }: { services: AuthServices; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'restoring' });
  const [attempt, setAttempt] = useState(0);
  const signedIn = useRef(false);

  useEffect(() => {
    signedIn.current = state.status === 'authenticated';
  }, [state.status]);

  useEffect(() => services.registerSessionCleaner(() => queryClient.clear()), [services, queryClient]);

  useEffect(() => {
    let cancelled = false;
    services.restoreSession().then(
      (session) => {
        if (!cancelled) setState(session ? { status: 'authenticated', session } : ANONYMOUS);
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'failed', error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [services, attempt]);

  useEffect(
    () =>
      services.sessionEvents.subscribe(() => {
        // A request still in flight after "Sair" must not announce an expiry.
        if (!signedIn.current) return;
        services.logout();
        setState({ status: 'anonymous', notice: SESSION_EXPIRED_MESSAGE });
      }),
    [services],
  );

  const login = useCallback(
    async (credentials: Credentials) => {
      const session = await services.login(credentials);
      setState({ status: 'authenticated', session });
    },
    [services],
  );

  const logout = useCallback(() => {
    services.logout();
    setState(ANONYMOUS);
  }, [services]);

  const retryRestore = useCallback(() => {
    setState({ status: 'restoring' });
    setAttempt((count) => count + 1);
  }, []);

  const value = useMemo(() => ({ state, login, logout, retryRestore }), [state, login, logout, retryRestore]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

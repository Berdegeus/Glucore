import type { ReactNode } from 'react';
import { Navigate, useLocation, type Location } from 'react-router';
import { homePathFor, type Role } from '../../../shared/domain/role';
import { ErrorState, Skeleton } from '../../../shared/presentation/ui/states';
import { useAuth } from './authProvider';

export const LOGIN_PATH = '/login';
export const UNAVAILABLE_MESSAGE = 'Serviço indisponível. Tente novamente em instantes.';

const BASE = 'http://app.invalid';
/** The router ignores case and a trailing slash, so the loop guard does too. */
const LOGIN_ROUTE = /^\/login\/*$/i;

/**
 * The page to return to after login, or null when it is not a path of this
 * app (ACC-04). The URL parser decides: `//evil.com`, `/\evil.com` and a path
 * with a hidden tab or newline resolve to another origin, and `https://x` or
 * `javascript:` do not start with a slash. The login page itself is dropped to
 * avoid a loop.
 */
export function safeInternalPath(next: string | null | undefined): string | null {
  if (!next?.startsWith('/')) return null;
  const url = new URL(next, BASE);
  if (url.origin !== BASE) return null;
  return LOGIN_ROUTE.test(url.pathname) ? null : next;
}

/** `/login?next=<requested path>`, with the path the person asked for (ACC-04). */
export function loginPathFor(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const requested = safeInternalPath(`${location.pathname}${location.search}${location.hash}`);
  return requested ? `${LOGIN_PATH}?next=${encodeURIComponent(requested)}` : LOGIN_PATH;
}

/** Where a signed-in person goes after login: the safe `next`, else their own home (ACC-02). */
export function resolvePostLoginPath(next: string | null | undefined, role: Role): string {
  return safeInternalPath(next) ?? homePathFor(role);
}

/**
 * Renders `children` only for a signed-in person with `requiredRole`. Anyone else is
 * redirected before a single child mounts: an anonymous visitor to the login,
 * remembering where they were going (ACC-04), and someone of another role to
 * their own dashboard (ACC-03). The server still answers `403 FORBIDDEN_ROLE`
 * to a call made with the wrong token; this guard only spares the screen.
 */
export function RequireRole({ requiredRole, children }: { requiredRole: Role; children: ReactNode }) {
  const { state, retryRestore } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case 'restoring':
      return <Skeleton height="100vh" />;
    case 'failed':
      return <ErrorState message={UNAVAILABLE_MESSAGE} onRetry={retryRestore} />;
    case 'anonymous':
      return <Navigate to={loginPathFor(location)} replace />;
    case 'authenticated':
      return state.session.account.role === requiredRole ? (
        children
      ) : (
        <Navigate to={homePathFor(state.session.account.role)} replace />
      );
  }
}

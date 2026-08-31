import type { Request, Response, NextFunction } from 'express';

import type { UserRoleName } from './claims';
import { verifyAccessToken } from './jwt';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRoleName;
}

/**
 * Authentication and authorization, shared by every service that reads a
 * Glucore token.
 *
 * This lives here rather than in each service because it no longer touches a
 * database: once the role travels in the claim, verifying a request is pure
 * work over the token, and two copies of pure work is two chances to drift.
 *
 * The signing secret arrives as a getter rather than a value. Each service
 * resolves it through its own `lib/env`, on first use rather than at import, so
 * that importing a module cannot fail merely because the environment was
 * arranged afterwards.
 */
export function createVerifyJwt(getSecret: () => string) {
  return function verifyJwt(req: AuthRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
      return;
    }

    const claims = verifyAccessToken(header.slice(7), getSecret());
    if (!claims) {
      res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
      return;
    }

    req.userId = claims.sub;
    req.userRole = claims.role;
    next();
  };
}

/**
 * Authorizes the request against the allowed roles. Must run after `verifyJwt`.
 *
 * Synchronous, because the answer is already on the request. The version this
 * replaces queried `User.role` per request so that a demotion took effect at
 * once; see `claims.ts` for why that trade stopped paying once identity moved
 * behind a network boundary.
 */
export function requireRole(roles: string | readonly string[]) {
  const allowed = typeof roles === 'string' ? [roles] : [...roles];

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Both fields are set together by verifyJwt, so either one missing means
    // this middleware ran without it — a wiring mistake, not a client one. It
    // still answers 401: an unauthenticated request is exactly what reaches
    // here when the order is wrong, and 403 would imply the caller is known.
    if (!req.userId || !req.userRole) {
      res.status(401).json({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
      return;
    }

    if (!allowed.includes(req.userRole)) {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
      return;
    }

    next();
  };
}

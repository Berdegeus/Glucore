import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type UserRoleName } from '@glucore/shared';

import { getJwtSecret } from '../lib/env';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRoleName;
}

export function verifyJwt(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    return;
  }

  const claims = verifyAccessToken(header.slice(7), getJwtSecret());
  if (!claims) {
    res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    return;
  }

  req.userId = claims.sub;
  req.userRole = claims.role;
  next();
}

/**
 * Authorizes the request against the allowed roles. Must run after `verifyJwt`.
 *
 * The role comes from the verified token, not from a database lookup. This
 * service is about to stop owning the `User` table altogether, so there is no
 * row here to read — but the reasoning would hold even if there were: see
 * `packages/shared/src/auth/claims.ts` for why the trade the other way costs
 * more than it buys.
 *
 * Synchronous by consequence. The previous version returned a promise because
 * it queried; now that the answer is already on the request, making the caller
 * wait a tick would be theatre.
 */
export function requireRole(roles: string | readonly string[]) {
  const allowed = typeof roles === 'string' ? [roles] : [...roles];

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Both `userId` and `userRole` are set together by verifyJwt, so either one
    // being absent means this middleware ran without it — a wiring mistake, not
    // a client one. It still answers 401 rather than 500: an unauthenticated
    // request is exactly what reaches here when the order is wrong.
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

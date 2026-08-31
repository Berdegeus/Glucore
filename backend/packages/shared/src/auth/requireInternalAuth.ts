import type { Request, Response, NextFunction } from 'express';

import type { UserRoleName } from './claims';
import { verifyInternalToken } from './internalToken';

export interface InternalAuthRequest extends Request {
  internalUserId?: string;
  internalUserRole?: UserRoleName;
}

/**
 * Gate for every `/internal/*` route.
 *
 * Reads identity **only** from `x-internal-token`, verified against
 * `INTERNAL_JWT_SECRET`. `x-user-id`/`x-user-role`, also sent by the gateway,
 * are for log correlation only and are never consulted here — a handler that
 * read them instead would let anyone who can reach this port impersonate any
 * user by setting a header. That single rule is what makes the anti-spoofing
 * scheme real instead of decorative (see the gateway's authenticate
 * middleware, which is the only thing allowed to mint this token).
 */
export function createRequireInternalAuth(getSecret: () => string) {
  return function requireInternalAuth(req: InternalAuthRequest, res: Response, next: NextFunction): void {
    const header = req.headers['x-internal-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
      return;
    }

    const claims = verifyInternalToken(token, getSecret());
    if (!claims) {
      res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
      return;
    }

    req.internalUserId = claims.sub;
    req.internalUserRole = claims.role;
    next();
  };
}

import type { Response, NextFunction } from 'express';

import type { InternalAuthRequest } from './requireInternalAuth';

/**
 * Authorizes an internal request against the allowed roles. Must run after
 * `requireInternalAuth`, which is what puts the role on the request.
 *
 * The internal twin of `requireRole`: the gateway already checked the role at
 * the public edge, and the service checks it again (defense in depth, ADM-05)
 * from the signed internal token, never from a header.
 */
export function requireInternalRole(roles: string | readonly string[]) {
  const allowed = typeof roles === 'string' ? [roles] : [...roles];

  return (req: InternalAuthRequest, res: Response, next: NextFunction): void => {
    // `requireInternalAuth` sets both fields together, so a missing one means
    // this ran without it. 401, as in `requireRole`: 403 would imply the caller
    // is known.
    if (!req.internalUserId || !req.internalUserRole) {
      res.status(401).json({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
      return;
    }

    if (!allowed.includes(req.internalUserRole)) {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
      return;
    }

    next();
  };
}

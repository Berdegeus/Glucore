import { createRequireInternalAuth, createVerifyJwt, requireRole } from '@glucore/shared';

import { getInternalJwtSecret, getJwtSecret } from '../lib/env';

/**
 * This service's binding of the shared auth middleware.
 *
 * The behaviour is in `@glucore/shared` because it is identical in every
 * service that reads a Glucore token, and it can be shared at all because it no
 * longer reads the database — the role travels in the claim. What is local is
 * the secret: each service resolves it through its own `lib/env`.
 */
export const verifyJwt = createVerifyJwt(getJwtSecret);

/** Gate for every `/internal/*` route. Only the gateway holds this secret. */
export const requireInternalAuth = createRequireInternalAuth(getInternalJwtSecret);

export { requireRole };
export type { AuthRequest, InternalAuthRequest } from '@glucore/shared';

import { createRequireInternalAuth, createVerifyJwt, requireRole } from '@glucore/shared';

import { getInternalJwtSecret, getJwtSecret } from '../lib/env';

/** See glucose-service's copy: same shared behaviour, this service's secret. */
export const verifyJwt = createVerifyJwt(getJwtSecret);

/** Gate for every `/internal/*` route. Only the gateway holds this secret. */
export const requireInternalAuth = createRequireInternalAuth(getInternalJwtSecret);

export { requireRole };
export type { AuthRequest, InternalAuthRequest } from '@glucore/shared';

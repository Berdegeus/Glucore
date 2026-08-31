import { createVerifyJwt, requireRole } from '@glucore/shared';

import { getJwtSecret } from '../lib/env';

/** See glucose-service's copy: same shared behaviour, this service's secret. */
export const verifyJwt = createVerifyJwt(getJwtSecret);

export { requireRole };
export type { AuthRequest } from '@glucore/shared';

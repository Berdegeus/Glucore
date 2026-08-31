import type { InternalTokenClaims } from '@glucore/shared';

/**
 * The identity a client stamps on an explicit-id call — registration and the
 * two deletes — where there is either no caller identity yet (registration)
 * or the caller was already authorized by the gateway before this call was
 * made (delete). The defense on these routes is network isolation plus proof
 * of holding `INTERNAL_JWT_SECRET`, not this `sub` — see `requireInternalAuth`.
 */
export const GATEWAY_SERVICE_IDENTITY: InternalTokenClaims = { sub: 'gateway', role: 'ADMINISTRATOR' };

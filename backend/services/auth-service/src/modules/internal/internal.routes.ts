import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { InternalAccountsController } from './internal.controller';

/**
 * Mounted at `/internal`, separate from `/auth`: this router must not inherit
 * `verifyJwt` (there is no end-user token on these calls) nor the public rate
 * limiters (the caller is the gateway, already rate-limited on the public
 * side).
 */
export function createInternalAccountsRouter(
  controller: InternalAccountsController,
  requireInternalAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireInternalAuth);

  router.post('/accounts', asyncHandler(controller.register));
  router.get('/accounts/me', asyncHandler(controller.getMe));
  router.put('/accounts/me', asyncHandler(controller.updateMe));
  router.delete('/accounts/:id', asyncHandler(controller.deleteById));

  return router;
}

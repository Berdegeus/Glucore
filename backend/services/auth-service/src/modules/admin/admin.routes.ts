import { Router, type RequestHandler } from 'express';
import { asyncHandler, requireInternalRole } from '@glucore/shared';

import type { AdminController } from './admin.controller';

/**
 * Mounted at `/internal/admin`, behind the internal token and then the role
 * check: the gateway already limits `/api/v1/admin/*` to administrators, and
 * this repeats it from the signed identity so a leaked internal secret alone
 * does not open the account list (ADM-05).
 */
export function createAdminRouter(
  controller: AdminController,
  requireInternalAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireInternalAuth);
  router.use(requireInternalRole('ADMINISTRATOR'));

  router.get('/stats', asyncHandler(controller.stats));
  router.get('/users', asyncHandler(controller.users));

  return router;
}

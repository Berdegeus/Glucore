import { Router, type RequestHandler } from 'express';
import { asyncHandler, requireRole } from '@glucore/shared';

import type { AdminController } from './admin.controller';

/**
 * Mounted at `/api/v1/admin`. There is no `admin` proxy prefix: every route
 * here is a composition, and anything else under the prefix is a plain 404.
 * Only an administrator passes; the services check the role again from the
 * internal token (ADM-05).
 */
export function createAdminRouter(controller: AdminController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);
  router.use(requireRole('ADMINISTRATOR'));

  router.get('/overview', asyncHandler(controller.overview));
  router.get('/users', asyncHandler(controller.users));

  return router;
}

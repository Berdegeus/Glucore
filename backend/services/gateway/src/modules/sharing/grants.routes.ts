import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { GrantsController } from './grants.controller';

/**
 * Mounted at `/api/v1/sharing/grants`, ahead of the `sharing` proxy. It answers
 * only `GET /`; everything else under that path (`DELETE /:id`) falls through
 * to the proxy unchanged, and so does it before authenticating, since the
 * proxy authenticates for itself.
 */
export function createGrantsRouter(controller: GrantsController, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/', authenticate, asyncHandler(controller.list));
  return router;
}

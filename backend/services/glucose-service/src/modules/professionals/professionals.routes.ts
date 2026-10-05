import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { ProfessionalsController } from './professionals.controller';

/**
 * Mounted at `/internal` beside the patient router: no `verifyJwt`, the caller
 * is the gateway. `POST` and `GET /me` take the identity from the internal
 * token's `sub`, never from the body, and only for a HEALTH_PROFESSIONAL
 * identity. `DELETE /:id` is the gateway acting on a known id (saga
 * compensation, account deletion), authorized like `DELETE /patients/:id`.
 */
export function createInternalProfessionalsRouter(
  controller: ProfessionalsController,
  requireInternalAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireInternalAuth);

  router.post('/professionals', asyncHandler(controller.createInternal));
  router.get('/professionals/me', asyncHandler(controller.getMe));
  router.delete('/professionals/:id', asyncHandler(controller.deleteById));

  return router;
}

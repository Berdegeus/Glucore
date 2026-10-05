import { Router } from 'express';
import { asyncHandler } from '@glucore/shared';

import { verifyJwt } from '../../middleware/auth';

import type { PreferencesController } from './preferences.controller';

/**
 * Mounted at `/preferences`. Any role may keep a layout; which widgets it may
 * hold is decided by the role in the token, inside the service.
 */
export function createPreferencesRouter(controller: PreferencesController): Router {
  const router = Router();
  router.use(verifyJwt);

  router.get('/dashboard', asyncHandler(controller.getDashboard));
  router.put('/dashboard', asyncHandler(controller.saveDashboard));
  router.delete('/dashboard', asyncHandler(controller.resetDashboard));

  return router;
}

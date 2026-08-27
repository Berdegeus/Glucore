import { asyncHandler } from '@glucore/shared';
import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth';
import type { SettingsController } from './settings.controller';

export function createSettingsRouter(controller: SettingsController): Router {
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT'));

  router.get('/alerts', asyncHandler(controller.getAlerts));
  router.put('/alerts', asyncHandler(controller.updateAlerts));

  return router;
}

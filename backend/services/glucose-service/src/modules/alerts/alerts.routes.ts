import { asyncHandler } from '@glucore/shared';
import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth';
import type { AlertsController } from './alerts.controller';

export function createAlertsRouter(controller: AlertsController): Router {
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT'));

  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.replaceAll));

  return router;
}

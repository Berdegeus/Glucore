import { asyncHandler } from '@glucore/shared';
import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth';
import type { DashboardController } from './dashboard.controller';

export function createDashboardRouter(controller: DashboardController): Router {
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT'));

  router.get('/summary', asyncHandler(controller.summary));

  return router;
}

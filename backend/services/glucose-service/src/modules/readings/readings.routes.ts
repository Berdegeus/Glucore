import { asyncHandler } from '@glucore/shared';
import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth';
import type { ReadingsController } from './readings.controller';

export function createReadingsRouter(controller: ReadingsController): Router {
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT'));

  router.get('/', asyncHandler(controller.list));
  router.post('/', asyncHandler(controller.sync));
  router.delete('/', asyncHandler(controller.clear));

  return router;
}

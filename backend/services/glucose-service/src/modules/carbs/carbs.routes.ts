import { asyncHandler } from '@glucore/shared';
import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth';
import type { CarbsController } from './carbs.controller';

export function createCarbsRouter(controller: CarbsController): Router {
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT'));

  router.get('/', asyncHandler(controller.list));
  router.post('/item', asyncHandler(controller.create));
  router.put('/item/:id', asyncHandler(controller.update));
  router.delete('/item/:id', asyncHandler(controller.remove));

  // Deprecated: replace-all batch. Superseded by the /item routes above.
  router.post('/', asyncHandler(controller.replaceAll));

  return router;
}

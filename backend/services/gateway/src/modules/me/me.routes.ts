import express, { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { MeController } from './me.controller';

export function createMeRouter(controller: MeController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(express.json());
  router.use(authenticate);

  router.get('/', asyncHandler(controller.get));
  router.put('/', asyncHandler(controller.update));

  return router;
}

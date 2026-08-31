import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { AccountController } from './account.controller';

export function createAccountRouter(controller: AccountController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);
  router.delete('/', asyncHandler(controller.remove));
  return router;
}

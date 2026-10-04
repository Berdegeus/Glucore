import express, { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { RegisterController } from './register.controller';

/**
 * `express.json()` is scoped to this router alone, never global — see
 * `app.ts`'s own comment on why a global body parser would break every
 * proxied route.
 */
export function createRegisterRouter(
  controller: RegisterController,
  ...middlewares: RequestHandler[]
): Router {
  const router = Router();
  router.use(express.json());
  router.post('/', ...middlewares, asyncHandler(controller.register));
  return router;
}

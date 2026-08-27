import { Router } from 'express';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { asyncHandler } from '@glucore/shared';

import { verifyJwt } from '../../middleware/auth';

import type { SessionsController } from './sessions.controller';

export function createSessionsRouter(
  controller: SessionsController,
  strictLimiter: RateLimitRequestHandler,
): Router {
  const router = Router();

  router.post('/login', strictLimiter, asyncHandler(controller.login));
  router.get('/status', verifyJwt, controller.status);

  return router;
}

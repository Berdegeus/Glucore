import { Router } from 'express';
import { asyncHandler } from '@glucore/shared';

import { verifyJwt } from '../../middleware/auth';

import type { SessionsController } from './sessions.controller';

/** Rate limiting moved to the gateway (phase 4.4) — the counter is per-client there. */
export function createSessionsRouter(controller: SessionsController): Router {
  const router = Router();

  router.post('/login', asyncHandler(controller.login));
  router.get('/status', verifyJwt, controller.status);
  router.post('/refresh', verifyJwt, asyncHandler(controller.refresh));

  return router;
}

import { Router } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { PasswordController } from './password.controller';

/** Rate limiting moved to the gateway (phase 4.4) — the counter is per-client there. */
export function createPasswordRouter(controller: PasswordController): Router {
  const router = Router();

  router.post('/forgot-password', asyncHandler(controller.forgotPassword));
  router.post('/reset-password', asyncHandler(controller.resetPassword));

  return router;
}

import { Router } from 'express';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { asyncHandler } from '@glucore/shared';

import type { PasswordController } from './password.controller';

export function createPasswordRouter(
  controller: PasswordController,
  strictLimiter: RateLimitRequestHandler,
): Router {
  const router = Router();

  router.post('/forgot-password', strictLimiter, asyncHandler(controller.forgotPassword));
  router.post('/reset-password', strictLimiter, asyncHandler(controller.resetPassword));

  return router;
}

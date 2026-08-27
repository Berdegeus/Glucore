import { Router } from 'express';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { asyncHandler } from '@glucore/shared';

import { verifyJwt } from '../../middleware/auth';

import type { AccountsController } from './accounts.controller';

/**
 * Account routes. Still mounted under `/auth` and still named `/profile`: the
 * rename to `/api/v1/me` is part of the gateway's contract batch, and doing it
 * here would break the app twice instead of once.
 */
export function createAccountsRouter(
  controller: AccountsController,
  registerLimiter: RateLimitRequestHandler,
): Router {
  const router = Router();

  router.post('/register', registerLimiter, asyncHandler(controller.register));
  router.get('/profile', verifyJwt, asyncHandler(controller.getAccount));
  router.put('/profile', verifyJwt, asyncHandler(controller.updateAccount));

  return router;
}

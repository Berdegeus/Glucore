import { asyncHandler } from '@glucore/shared';
import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth';
import type { SharingController } from './sharing.controller';

/**
 * `verifyJwt` first, then the role per route: the patient side (generate, list,
 * revoke) and the professional side (redeem) never share a handler (ACC-06).
 * Throttling redeem is the gateway's job (CON-06), not this service's.
 */
export function createSharingRouter(controller: SharingController): Router {
  const router = Router();

  router.use(verifyJwt);

  router.post('/invites', requireRole('PATIENT'), asyncHandler(controller.createInvite));
  router.get('/grants', requireRole('PATIENT'), asyncHandler(controller.listGrants));
  router.delete('/grants/:id', requireRole('PATIENT'), asyncHandler(controller.revokeGrant));
  router.post('/redeem', requireRole('HEALTH_PROFESSIONAL'), asyncHandler(controller.redeem));

  return router;
}

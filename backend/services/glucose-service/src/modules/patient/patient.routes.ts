import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { PatientController } from './patient.controller';

/**
 * Mounted at `/internal`, separate from the five public routers: no
 * `verifyJwt`, no rate limiting — the caller is the gateway.
 *
 * `POST /patients` takes its identity from the internal token's `sub`, not
 * from the body: by the time the gateway calls this (after auth-service has
 * created the account), it already knows the real userId and asserts it the
 * same way every other identity-scoped call does. A body-supplied id would
 * reopen the spoofing hole `requireInternalAuth` exists to close.
 */
export function createInternalPatientRouter(
  controller: PatientController,
  requireInternalAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireInternalAuth);

  router.post('/patients', asyncHandler(controller.createInternal));
  router.get('/patients/me', asyncHandler(controller.getMe));
  router.put('/patients/me', asyncHandler(controller.updateMe));
  router.delete('/patients/:id', asyncHandler(controller.deleteById));

  return router;
}

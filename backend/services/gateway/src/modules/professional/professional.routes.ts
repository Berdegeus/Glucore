import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@glucore/shared';

import type { PatientsController } from './patients.controller';

/**
 * Mounted at `/api/v1/professional/patients`, ahead of the `professional` proxy.
 * It answers only `GET /`; the patient's own summary (`GET /:id/summary`) falls
 * through to the proxy unchanged.
 */
export function createPatientsRouter(controller: PatientsController, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/', authenticate, asyncHandler(controller.list));
  return router;
}

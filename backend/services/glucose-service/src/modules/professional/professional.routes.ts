import { asyncHandler } from '@glucore/shared';
import { Router } from 'express';

import { requireRole, verifyJwt } from '../../middleware/auth';
import type { ProfessionalController } from './professional.controller';

/**
 * Only a health professional reads the portfolio (ACC-06); a patient token is
 * `403 FORBIDDEN_ROLE`. Which patients a professional may see is the service's
 * job, through the grants, not the role's.
 */
export function createProfessionalRouter(controller: ProfessionalController): Router {
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('HEALTH_PROFESSIONAL'));

  router.get('/patients', asyncHandler(controller.listPatients));
  router.get('/patients/:id/summary', asyncHandler(controller.patientSummary));
  router.get('/cohort/summary', asyncHandler(controller.cohortSummary));

  return router;
}

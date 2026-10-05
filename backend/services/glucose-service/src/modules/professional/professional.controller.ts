import { auditRequestContext, requireUuid } from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import { parseDashboardQuery } from '../dashboard/dashboard.schema';
import { parseCohortQuery, parsePatientListQuery } from './professional.schema';
import type { ProfessionalService } from './professional.service';

/** Translates between HTTP and the service; the token's user is always the professional. */
export class ProfessionalController {
  constructor(private readonly service: ProfessionalService) {}

  listPatients = async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parsePatientListQuery(req.query);
    res.json(await this.service.listPatients(req.userId!, query, auditRequestContext(req)));
  };

  patientSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    const patientId = requireUuid(req.params.id);
    const query = parseDashboardQuery(req.query);
    res.json(await this.service.patientSummary(req.userId!, patientId, query, auditRequestContext(req)));
  };

  cohortSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseCohortQuery(req.query);
    res.json(await this.service.cohortSummary(req.userId!, query, auditRequestContext(req)));
  };
}

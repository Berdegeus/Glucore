import type { Response } from 'express';
import { auditRequestContext, type InternalAuthRequest } from '@glucore/shared';

import { parseCreatePatient, parseUpdatePatient } from './patient.schema';
import type { PatientService } from './patient.service';

export class PatientController {
  constructor(private readonly service: PatientService) {}

  createInternal = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    const input = parseCreatePatient(req.body ?? {});
    await this.service.createFromRegistration(req.internalUserId as string, input, auditRequestContext(req));
    res.status(201).json(await this.service.getForUser(req.internalUserId as string));
  };

  getMe = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.getForUser(req.internalUserId as string));
  };

  updateMe = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    const input = parseUpdatePatient(req.body ?? {});
    await this.service.update(req.internalUserId as string, input, auditRequestContext(req));
    res.json(await this.service.getForUser(req.internalUserId as string));
  };

  deleteById = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    await this.service.deleteByUserId(req.params.id);
    res.status(204).send();
  };
}

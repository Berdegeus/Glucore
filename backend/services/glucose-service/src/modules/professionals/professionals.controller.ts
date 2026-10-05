import type { Response } from 'express';
import { ForbiddenError, type InternalAuthRequest } from '@glucore/shared';

import { parseProfessional } from './professionals.schema';
import type { ProfessionalsService } from './professionals.service';

export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  createInternal = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    assertProfessional(req);
    const input = parseProfessional(req.body ?? {});
    res.status(201).json(await this.service.create(req.internalUserId as string, input));
  };

  getMe = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    assertProfessional(req);
    res.json(await this.service.getForUser(req.internalUserId as string));
  };

  deleteById = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    await this.service.deleteByUserId(req.params.id);
    res.status(204).send();
  };
}

/** The profile belongs to a professional account; a patient's or admin's token is refused. */
function assertProfessional(req: InternalAuthRequest): void {
  if (req.internalUserRole !== 'HEALTH_PROFESSIONAL') {
    throw new ForbiddenError('Forbidden', 'FORBIDDEN_ROLE');
  }
}

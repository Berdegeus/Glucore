import { auditRequestContext, BadRequestError } from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import type { AlertsService } from './alerts.service';

export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.listForUser(req.userId!));
  };

  replaceAll = async (req: AuthRequest, res: Response): Promise<void> => {
    const { alerts } = (req.body ?? {}) as { alerts?: unknown };
    if (!Array.isArray(alerts)) throw new BadRequestError('alerts must be array');
    await this.service.replaceAllForUser(req.userId!, alerts, auditRequestContext(req));
    res.status(204).send();
  };
}

import { auditRequestContext } from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import type { AlertThresholdsDto, SettingsService } from './settings.service';

export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  getAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.getForUser(req.userId!));
  };

  updateAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.service.updateForUser(
      req.userId!,
      req.body as AlertThresholdsDto,
      auditRequestContext(req),
    );
    res.status(204).send();
  };
}

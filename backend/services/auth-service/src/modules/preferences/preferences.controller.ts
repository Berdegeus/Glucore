import type { Response } from 'express';
import type { UserRoleName } from '@glucore/shared';

import type { AuthRequest } from '../../middleware/auth';

import type { PreferencesService } from './preferences.service';

/**
 * Reads the request, calls the service, picks the status. The user and role
 * come from `verifyJwt`, never from the path or the body (LAY-12).
 */
export class PreferencesController {
  constructor(private readonly service: PreferencesService) {}

  getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.get(req.userId as string));
  };

  saveDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    const role = req.userRole as UserRoleName;
    res.json(await this.service.save(req.userId as string, role, req.body));
  };

  resetDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.service.reset(req.userId as string);
    res.status(204).end();
  };
}

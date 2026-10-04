import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import type { DashboardService } from './dashboard.service';
import { parseDashboardQuery } from './dashboard.schema';

/**
 * Translates between HTTP and the service. Nothing here knows about Prisma or
 * raw SQL — that stays in the repository.
 */
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  summary = async (req: AuthRequest, res: Response): Promise<void> => {
    const query = parseDashboardQuery(req.query);
    res.json(await this.service.getSummaryForUser(req.userId!, query));
  };
}

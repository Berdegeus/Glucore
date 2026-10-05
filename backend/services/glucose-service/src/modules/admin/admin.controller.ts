import type { Request, Response } from 'express';
import { parseAdminRangeDays } from '@glucore/shared';

import type { AdminService } from './admin.service';

/** Reads the request, calls the service, picks the status. The role was already checked by the router. */
export class AdminController {
  constructor(private readonly service: AdminService) {}

  stats = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.stats(parseAdminRangeDays(req.query.days)));
  };
}

import type { Request, Response } from 'express';
import { auditRequestContext, parseAdminRangeDays, type InternalAuthRequest } from '@glucore/shared';

import { parseUserListQuery } from './admin.schema';
import type { AdminService } from './admin.service';

/**
 * Reads the request, calls the service, picks the status. The admin's id comes
 * from the verified internal token (`requireInternalAuth`), never from the
 * query or a header (ADM-05).
 */
export class AdminController {
  constructor(private readonly service: AdminService) {}

  stats = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.stats(parseAdminRangeDays(req.query.days)));
  };

  users = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    const query = parseUserListQuery(req.query);
    res.json(await this.service.listUsers(req.internalUserId as string, query, auditRequestContext(req)));
  };
}

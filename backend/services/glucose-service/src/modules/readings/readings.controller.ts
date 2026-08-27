import { auditRequestContext } from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import type { ReadingsService } from './readings.service';
import { parseReadingBatch } from './readings.schema';

/**
 * Translates between HTTP and the service. Nothing here knows about Prisma, and
 * nothing below here knows about express.
 */
export class ReadingsController {
  constructor(private readonly service: ReadingsService) {}

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.listForUser(req.userId!));
  };

  sync = async (req: AuthRequest, res: Response): Promise<void> => {
    const readings = parseReadingBatch(req.body);
    await this.service.syncForUser(req.userId!, readings);
    res.status(204).send();
  };

  clear = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.service.clearForUser(req.userId!, auditRequestContext(req));
    res.status(204).send();
  };
}

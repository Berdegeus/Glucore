import { auditRequestContext, BadRequestError, optionalUuid, requireUuid } from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import type { CarbsService } from './carbs.service';
import { parseCarbBody } from './carbs.schema';

export class CarbsController {
  constructor(private readonly service: CarbsService) {}

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.listForUser(req.userId!));
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    // Body before id: on a create the id is optional, so a caller who omits it
    // should still hear about a malformed body first.
    const entry = parseCarbBody(req.body);
    const id = optionalUuid((req.body as { id?: unknown } | undefined)?.id);
    const created = await this.service.createForUser(
      req.userId!,
      { ...entry, id },
      auditRequestContext(req),
    );
    res.status(201).json({ id: created });
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    // Id before body here: a malformed id means the route matched nothing the
    // caller owns, whatever the body says.
    const id = requireUuid(req.params.id);
    const entry = parseCarbBody(req.body);
    await this.service.updateForUser(req.userId!, id, entry, auditRequestContext(req));
    res.status(204).send();
  };

  remove = async (req: AuthRequest, res: Response): Promise<void> => {
    const id = requireUuid(req.params.id);
    await this.service.deleteForUser(req.userId!, id, auditRequestContext(req));
    res.status(204).send();
  };

  /** Deprecated batch replace; see CarbsService.replaceAllForUser. */
  replaceAll = async (req: AuthRequest, res: Response): Promise<void> => {
    const { carbs } = (req.body ?? {}) as { carbs?: unknown };
    if (!Array.isArray(carbs)) throw new BadRequestError('carbs must be array');
    await this.service.replaceAllForUser(req.userId!, carbs, auditRequestContext(req));
    res.status(204).send();
  };
}

import {
  auditRequestContext,
  BadRequestError,
  optionalUuid,
  requireUuid,
} from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import type { AlertsService } from './alerts.service';
import { parseAlertBody } from './alerts.schema';

export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.listForUser(req.userId!, req.query));
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    // Body before id: on a create the id is optional, so a caller who omits it
    // should still hear about a malformed body first.
    const entry = parseAlertBody(req.body);
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
    const entry = parseAlertBody(req.body);
    await this.service.updateForUser(req.userId!, id, entry, auditRequestContext(req));
    res.status(204).send();
  };

  remove = async (req: AuthRequest, res: Response): Promise<void> => {
    const id = requireUuid(req.params.id);
    await this.service.deleteForUser(req.userId!, id, auditRequestContext(req));
    res.status(204).send();
  };

  /** Deprecated batch replace; see AlertsService.replaceAllForUser. */
  replaceAll = async (req: AuthRequest, res: Response): Promise<void> => {
    const { alerts } = (req.body ?? {}) as { alerts?: unknown };
    if (!Array.isArray(alerts)) throw new BadRequestError('alerts must be array');
    await this.service.replaceAllForUser(req.userId!, alerts, auditRequestContext(req));
    res.status(204).send();
  };
}

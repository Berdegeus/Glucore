import {
  auditRequestContext,
  BadRequestError,
  optionalUuid,
  requireUuid,
} from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import type { InsulinService } from './insulin.service';
import { parseInsulinBody } from './insulin.schema';

export class InsulinController {
  constructor(private readonly service: InsulinService) {}

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.listForUser(req.userId!));
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    // Body before id on a create, id before body on an update; see the carbs
    // controller for why the two differ.
    const entry = parseInsulinBody(req.body);
    const id = optionalUuid((req.body as { id?: unknown } | undefined)?.id);
    const created = await this.service.createForUser(
      req.userId!,
      { ...entry, id },
      auditRequestContext(req),
    );
    res.status(201).json({ id: created });
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    const id = requireUuid(req.params.id);
    const entry = parseInsulinBody(req.body);
    await this.service.updateForUser(req.userId!, id, entry, auditRequestContext(req));
    res.status(204).send();
  };

  remove = async (req: AuthRequest, res: Response): Promise<void> => {
    const id = requireUuid(req.params.id);
    await this.service.deleteForUser(req.userId!, id, auditRequestContext(req));
    res.status(204).send();
  };

  /** Deprecated batch replace; see InsulinService.replaceAllForUser. */
  replaceAll = async (req: AuthRequest, res: Response): Promise<void> => {
    const { insulin } = (req.body ?? {}) as { insulin?: unknown };
    if (!Array.isArray(insulin)) throw new BadRequestError('insulin must be array');
    await this.service.replaceAllForUser(req.userId!, insulin, auditRequestContext(req));
    res.status(204).send();
  };
}

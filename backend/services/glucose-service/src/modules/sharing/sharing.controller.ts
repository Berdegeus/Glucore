import { auditRequestContext, requireUuid } from '@glucore/shared';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth';
import { parseRedeemBody } from './sharing.schema';
import type { SharingService } from './sharing.service';

export class SharingController {
  constructor(private readonly service: SharingService) {}

  createInvite = async (req: AuthRequest, res: Response): Promise<void> => {
    res.status(201).json(await this.service.createInvite(req.userId!, auditRequestContext(req)));
  };

  listGrants = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json({ grants: await this.service.listGrants(req.userId!) });
  };

  revokeGrant = async (req: AuthRequest, res: Response): Promise<void> => {
    const grantId = requireUuid(req.params.id);
    await this.service.revoke(req.userId!, grantId, auditRequestContext(req));
    res.status(204).send();
  };

  redeem = async (req: AuthRequest, res: Response): Promise<void> => {
    const code = parseRedeemBody(req.body);
    const { status, patientId, grantId } = await this.service.redeem(
      req.userId!,
      code,
      auditRequestContext(req),
    );
    res.status(status).json({ patientId, grantId });
  };
}

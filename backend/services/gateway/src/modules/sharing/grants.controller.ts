import type { Response } from 'express';

import type { AuthClient } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';
import type { GatewayRequest } from '../../middleware/authenticate';

export class GrantsController {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  /**
   * API Composition: the grants are glucose's, the professionals' names are
   * auth's. The grants leg is not optional (whatever glucose answers, including
   * a 403 for a caller that is not a patient, is the answer); the names leg is,
   * because a list of links without names is still the list the patient needs
   * to revoke one. When it fails the names become `null` and `X-Degraded` says
   * so, the same convention as `GET /me`.
   *
   * A professional whose account is gone has no name either, but that is not a
   * degraded answer: the lookup worked, there is just nothing to show.
   */
  list = async (req: GatewayRequest, res: Response): Promise<void> => {
    const { grants } = await this.glucoseClient.listGrants(req.headers.authorization as string);

    let names = new Map<string, string>();
    try {
      names = await this.authClient.lookupAccounts(grants.map((grant) => grant.professionalId));
    } catch (error) {
      console.warn(`[gateway] professional names leg failed for userId=${req.userId}: ${String(error)}`);
      res.set('X-Degraded', 'professional-names');
    }

    res.json({
      grants: grants.map((grant) => ({
        id: grant.id,
        professional: { fullName: names.get(grant.professionalId) ?? null, specialty: grant.specialty },
        grantedAt: grant.grantedAt,
      })),
    });
  };
}

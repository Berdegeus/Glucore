import type { Response } from 'express';

import type { AuthClient } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';
import type { GatewayRequest } from '../../middleware/authenticate';

export class AccountController {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  /**
   * Clinical profile first (by role), then auth: a failure here leaves an
   * account with no data (recoverable — the row is gone, nothing points at it)
   * rather than clinical data with no owner. Every delete is idempotent, so a
   * retry after a partial failure is safe either way. An administrator has no
   * clinical profile in glucose-service, so only the account goes.
   */
  remove = async (req: GatewayRequest, res: Response): Promise<void> => {
    const userId = req.userId as string;
    const role = req.userRole!;

    if (role === 'PATIENT') await this.glucoseClient.deletePatient(userId);
    else if (role === 'HEALTH_PROFESSIONAL') await this.glucoseClient.deleteProfessional(userId);

    await this.authClient.deleteAccount(userId);
    res.status(204).send();
  };
}

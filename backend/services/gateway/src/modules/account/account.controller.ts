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
   * Glucose first, then auth: a failure here leaves an account with no data
   * (recoverable — the row is gone, nothing points at it) rather than
   * clinical data with no owner. Both deletes are idempotent, so a retry
   * after a partial failure is safe either way.
   */
  remove = async (req: GatewayRequest, res: Response): Promise<void> => {
    const userId = req.userId as string;
    await this.glucoseClient.deletePatient(userId);
    await this.authClient.deleteAccount(userId);
    res.status(204).send();
  };
}

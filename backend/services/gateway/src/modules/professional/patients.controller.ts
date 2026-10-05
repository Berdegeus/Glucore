import type { Response } from 'express';

import type { AuthClient } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';
import type { GatewayRequest } from '../../middleware/authenticate';
import { querySuffix, resolvePatientNames, withPatientName } from './patientNames';

export class PatientsController {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  /**
   * API Composition: the portfolio metrics are glucose's, the names are auth's
   * (the databases are separate). The portfolio leg is not optional: whatever
   * glucose-service answers, including `403 NO_ACTIVE_GRANT`/`FORBIDDEN_ROLE`
   * or a 503, is the answer. The names leg degrades to initials and
   * `X-Degraded: patient-names` (PRO-15).
   */
  list = async (req: GatewayRequest, res: Response): Promise<void> => {
    const page = await this.glucoseClient.listPatients(req.headers.authorization as string, querySuffix(req));

    const names = await resolvePatientNames(this.authClient, page.items, req, res);

    res.json({ ...page, items: page.items.map((item) => withPatientName(item, names)) });
  };
}

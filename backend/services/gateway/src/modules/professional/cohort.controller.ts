import type { Response } from 'express';

import type { AuthClient } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';
import type { GatewayRequest } from '../../middleware/authenticate';
import { querySuffix, resolvePatientNames, withPatientName } from './patientNames';

export class CohortController {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  /**
   * Same composition and the same degradation as the patient list
   * (`PatientsController.list`): the aggregates are glucose's and pass through
   * untouched, the names are auth's and land in `perPatient` only.
   */
  summary = async (req: GatewayRequest, res: Response): Promise<void> => {
    const cohort = await this.glucoseClient.cohortSummary(req.headers.authorization as string, querySuffix(req));

    const names = await resolvePatientNames(this.authClient, cohort.perPatient, req, res);

    res.json({ ...cohort, perPatient: cohort.perPatient.map((entry) => withPatientName(entry, names)) });
  };
}

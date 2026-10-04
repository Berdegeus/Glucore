import type { Response } from 'express';

import type { AuthClient } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';
import type { GatewayRequest } from '../../middleware/authenticate';
import { splitProfileBody } from './me.schema';

/** The default patient block, matching glucose-service's own `toPatientDto` fallback. */
const DEFAULT_PATIENT_BLOCK = {
  birthDate: null,
  diabetesType: null,
  weightKg: null,
  targetRangeMin: 80,
  targetRangeMax: 180,
};

export class MeController {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  /**
   * API Composition: the account leg is not optional (identity always
   * answers or the whole request fails), the patient leg is — a missing
   * weight is not a reason to fail the profile screen.
   */
  get = async (req: GatewayRequest, res: Response): Promise<void> => {
    const userId = req.userId as string;
    const role = req.userRole!;

    const [account, patient] = await Promise.allSettled([
      this.authClient.getAccount(userId, role),
      this.glucoseClient.getPatient(userId, role),
    ]);

    if (account.status === 'rejected') throw account.reason;

    if (patient.status === 'rejected') {
      console.warn(`[gateway] patient leg failed for userId=${userId}: ${String(patient.reason)}`);
      res.set('X-Degraded', 'patient-profile');
      res.json({ ...(account.value as object), patient: DEFAULT_PATIENT_BLOCK });
      return;
    }

    res.json({ ...(account.value as object), patient: patient.value });
  };

  /**
   * Auth first, on purpose: it is the leg that can 401 (wrong current
   * password) or 409 (email taken), so failing it before touching glucose
   * means nothing was half-saved. No compensation on failure here — undoing
   * a completed password change would be worse than a partial profile edit.
   */
  update = async (req: GatewayRequest, res: Response): Promise<void> => {
    const userId = req.userId as string;
    const role = req.userRole!;
    const { account, patient } = splitProfileBody((req.body ?? {}) as Record<string, unknown>);

    if (Object.keys(account).length > 0) {
      await this.authClient.updateAccount(userId, role, account);
    }

    if (Object.keys(patient).length > 0) {
      try {
        await this.glucoseClient.updatePatient(userId, role, patient);
      } catch (error) {
        console.error(`[gateway] patient update failed after account update succeeded userId=${userId}`, error);
        res.status(502).json({
          error: 'Account updated, but the patient profile failed to save.',
          code: 'PARTIAL_UPDATE',
        });
        return;
      }
    }

    res.json({ message: 'Profile updated.' });
  };
}

import type { Response } from 'express';
import type { UserRoleName } from '@glucore/shared';

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
   * API Composition, by role. The account leg is not optional (identity always
   * answers or the whole request fails); the clinical leg is, because a
   * missing profile is not a reason to fail the profile screen.
   *
   * Only a PATIENT is looked up in `patients`: glucose-service's patient `me`
   * route creates the row when it is missing (`ensure`), so asking it about a
   * professional or an administrator would invent a `Patient` for them.
   */
  get = async (req: GatewayRequest, res: Response): Promise<void> => {
    const userId = req.userId as string;
    const role = req.userRole!;

    if (role === 'PATIENT') {
      await this.composeWithProfile(res, userId, role, 'patient', DEFAULT_PATIENT_BLOCK, () =>
        this.glucoseClient.getPatient(userId, role),
      );
      return;
    }

    if (role === 'HEALTH_PROFESSIONAL') {
      await this.composeWithProfile(res, userId, role, 'professional', null, () =>
        this.glucoseClient.getProfessional(userId),
      );
      return;
    }

    res.json(await this.authClient.getAccount(userId, role));
  };

  private async composeWithProfile(
    res: Response,
    userId: string,
    role: UserRoleName,
    block: 'patient' | 'professional',
    fallback: unknown,
    fetchProfile: () => Promise<unknown>,
  ): Promise<void> {
    const [account, profile] = await Promise.allSettled([
      this.authClient.getAccount(userId, role),
      fetchProfile(),
    ]);

    if (account.status === 'rejected') throw account.reason;

    if (profile.status === 'rejected') {
      console.warn(`[gateway] ${block} leg failed for userId=${userId}: ${String(profile.reason)}`);
      res.set('X-Degraded', `${block}-profile`);
      res.json({ ...(account.value as object), [block]: fallback });
      return;
    }

    res.json({ ...(account.value as object), [block]: profile.value });
  }

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

    // Patient-block fields only mean something for a PATIENT; for any other
    // role they are ignored rather than rejected (the same leniency the
    // registration whitelist has), so a shared profile form cannot create a
    // `Patient` row for a professional through `updatePatient`.
    if (role === 'PATIENT' && Object.keys(patient).length > 0) {
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

import type { AuditContext, RecordAudit } from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import type { ISettingsRepository } from './settings.repository';

/** Alert thresholds as the app reads and writes them. */
export interface AlertThresholdsDto {
  lowThreshold: number;
  highThreshold: number;
}

/**
 * The range the app falls back to before a patient has ever saved one. Same
 * pair the registration flow writes, so a patient who never opens the settings
 * screen sees the value that is actually stored.
 */
const DEFAULT_LOW = 80;
const DEFAULT_HIGH = 180;

export class SettingsService {
  constructor(
    private readonly settings: ISettingsRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  async getForUser(userId: string): Promise<AlertThresholdsDto> {
    const patientId = await this.patients.ensure(userId);
    const config = await this.settings.find(patientId);
    return config
      ? { lowThreshold: config.lowGlucoseMgDl, highThreshold: config.highGlucoseMgDl }
      : { lowThreshold: DEFAULT_LOW, highThreshold: DEFAULT_HIGH };
  }

  /**
   * No validation, deliberately: this route accepts an inverted range today
   * (unlike the profile route, which rejects one) and the suite pins that.
   * Adding the check is a product decision — it needs the app to handle the
   * rejection, and a CHECK constraint to make it stick.
   */
  async updateForUser(
    userId: string,
    thresholds: AlertThresholdsDto,
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    await this.settings.upsert(patientId, {
      lowGlucoseMgDl: thresholds.lowThreshold,
      highGlucoseMgDl: thresholds.highThreshold,
    });
    await this.recordAudit({
      userId,
      entity: 'AlertThresholdConfig',
      action: 'UPDATE',
      entityId: patientId,
      ...context,
    });
  }
}

import { BadRequestError, type AuditContext, type RecordAudit } from '@glucore/shared';

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
   * Rejects an inverted range (phase 6, `glucose_metrics` migration): a
   * low >= high threshold makes every reading count as both hypo and hyper at
   * once, which broke the dashboard's TIR math the moment a real row like
   * that showed up in dev data. The database now backs this with a CHECK
   * constraint too — this is the app-side half so the caller gets a 400
   * instead of a raw constraint-violation 500.
   */
  async updateForUser(
    userId: string,
    thresholds: AlertThresholdsDto,
    context: AuditContext,
  ): Promise<void> {
    if (thresholds.lowThreshold >= thresholds.highThreshold) {
      throw new BadRequestError('lowThreshold must be less than highThreshold', 'INVALID_THRESHOLD_RANGE');
    }
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

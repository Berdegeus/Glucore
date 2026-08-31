import type { AuditContext, RecordAudit } from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { toAlertDto, toDbAlertType, type AlertDto } from './alerts.mapper';
import type { IAlertRepository } from './alerts.repository';

/** An alert input as the app sends it. */
export interface AlertInput {
  type: string;
  timestampMs: number;
}

/** The alert list shows a rolling window, not the whole history. */
const ALERT_PAGE = 100;

export class AlertsService {
  constructor(
    private readonly alerts: IAlertRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  async listForUser(userId: string): Promise<AlertDto[]> {
    const patientId = await this.patients.ensure(userId);
    const rows = await this.alerts.listRecent(patientId, ALERT_PAGE);
    return rows.map(toAlertDto);
  }

  /** Deprecated replace-all sync; see CarbsService.replaceAllForUser. */
  async replaceAllForUser(
    userId: string,
    alerts: readonly AlertInput[],
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    await this.alerts.replaceAll(
      patientId,
      alerts.slice(0, ALERT_PAGE).map((alert) => ({
        alertType: toDbAlertType(alert.type),
        triggeredAt: new Date(alert.timestampMs),
      })),
    );
    await this.recordAudit({
      userId,
      entity: 'AlertEvent',
      action: 'REPLACE',
      entityId: patientId,
      metadata: { count: alerts.length },
      ...context,
    });
  }
}

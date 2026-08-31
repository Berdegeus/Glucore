import {
  isUuid,
  NotFoundError,
  parsePageQuery,
  type AuditContext,
  type RecordAudit,
} from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { toAlertDto, toDbAlertType, type AlertDto } from './alerts.mapper';
import type { AlertCreate, AlertRow, IAlertRepository } from './alerts.repository';
import type { AlertInput } from './alerts.schema';

/** Cap kept from the pre-pagination batch endpoint; the /item path has none. */
const BATCH_LIMIT = 100;

export class AlertsService {
  constructor(
    private readonly alerts: IAlertRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  /** No `before`/`limit` keeps the pre-pagination shape: the 100 most recent. */
  async listForUser(
    userId: string,
    query: { before?: unknown; limit?: unknown } = {},
  ): Promise<AlertDto[]> {
    const page = parsePageQuery(query);
    const patientId = await this.patients.ensure(userId);
    const rows = await this.alerts.listPage(patientId, page);
    return rows.map(toAlertDto);
  }

  async createForUser(
    userId: string,
    entry: AlertInput & { id?: string },
    context: AuditContext,
  ): Promise<string> {
    const patientId = await this.patients.ensure(userId);
    const created = await this.alerts.create(patientId, {
      id: entry.id,
      alertType: toDbAlertType(entry.type),
      triggeredAt: new Date(entry.timestampMs),
    });
    await this.recordAudit({
      userId,
      entity: 'AlertEvent',
      action: 'CREATE',
      entityId: created.id,
      ...context,
    });
    return created.id;
  }

  async updateForUser(
    userId: string,
    id: string,
    entry: AlertInput,
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    const row: AlertRow = {
      alertType: toDbAlertType(entry.type),
      triggeredAt: new Date(entry.timestampMs),
    };
    // Another patient's id updates no row and answers 404: confirming that the
    // entry exists would leak the fact that someone else owns it.
    if ((await this.alerts.update(patientId, id, row)) === 0) {
      throw new NotFoundError('not found');
    }
    await this.recordAudit({
      userId,
      entity: 'AlertEvent',
      action: 'UPDATE',
      entityId: id,
      ...context,
    });
  }

  async deleteForUser(userId: string, id: string, context: AuditContext): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    if ((await this.alerts.delete(patientId, id)) === 0) {
      throw new NotFoundError('not found');
    }
    await this.recordAudit({
      userId,
      entity: 'AlertEvent',
      action: 'DELETE',
      entityId: id,
      ...context,
    });
  }

  /**
   * Deprecated replace-all sync, kept until the app moves to the item routes.
   *
   * It deletes the patient's diary and rewrites it, which loses entries made on
   * a second device and drops everything past the page size. Unlike the item
   * routes it validates nothing, and an id that is not a UUID is dropped rather
   * than rejected — the app has always relied on that.
   */
  async replaceAllForUser(
    userId: string,
    alerts: readonly (Partial<{ id: unknown }> & AlertInput)[],
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    const entries: AlertCreate[] = alerts.slice(0, BATCH_LIMIT).map((alert) => ({
      ...(isUuid(alert.id) ? { id: alert.id } : {}),
      alertType: toDbAlertType(alert.type),
      triggeredAt: new Date(alert.timestampMs),
    }));
    await this.alerts.replaceAll(patientId, entries);
    await this.recordAudit({
      userId,
      entity: 'AlertEvent',
      action: 'REPLACE',
      entityId: patientId,
      // The full count, not the truncated one: the gap between the two is the
      // symptom to look for when a diary comes back short.
      metadata: { count: alerts.length },
      ...context,
    });
  }
}

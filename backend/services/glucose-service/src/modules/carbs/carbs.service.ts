import {
  isUuid,
  NotFoundError,
  parsePageQuery,
  type AuditContext,
  type RecordAudit,
} from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { toCarbDto, type CarbDto } from './carbs.mapper';
import type { CarbCreate, ICarbRepository } from './carbs.repository';
import type { CarbInput } from './carbs.schema';

/** Cap kept from the pre-pagination batch endpoint; the /item path has none. */
const BATCH_LIMIT = 100;

export class CarbsService {
  constructor(
    private readonly carbs: ICarbRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  /** No `before`/`limit` keeps the pre-pagination shape: the 100 most recent. */
  async listForUser(
    userId: string,
    query: { before?: unknown; limit?: unknown } = {},
  ): Promise<CarbDto[]> {
    const page = parsePageQuery(query);
    const patientId = await this.patients.ensure(userId);
    const rows = await this.carbs.listPage(patientId, page);
    return rows.map(toCarbDto);
  }

  async createForUser(userId: string, entry: CarbCreate, context: AuditContext): Promise<string> {
    const patientId = await this.patients.ensure(userId);
    const created = await this.carbs.create(patientId, entry);
    await this.recordAudit({
      userId,
      entity: 'CarbEvent',
      action: 'CREATE',
      entityId: created.id,
      ...context,
    });
    return created.id;
  }

  async updateForUser(
    userId: string,
    id: string,
    entry: CarbInput,
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    // Another patient's id updates no row and answers 404: confirming that the
    // entry exists would leak the fact that someone else owns it.
    if ((await this.carbs.update(patientId, id, entry)) === 0) {
      throw new NotFoundError('not found');
    }
    await this.recordAudit({
      userId,
      entity: 'CarbEvent',
      action: 'UPDATE',
      entityId: id,
      ...context,
    });
  }

  async deleteForUser(userId: string, id: string, context: AuditContext): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    if ((await this.carbs.delete(patientId, id)) === 0) {
      throw new NotFoundError('not found');
    }
    await this.recordAudit({
      userId,
      entity: 'CarbEvent',
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
    entries: readonly (Partial<CarbCreate> & CarbInput)[],
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    await this.carbs.replaceAll(
      patientId,
      entries.slice(0, BATCH_LIMIT).map((entry) => ({
        ...entry,
        id: isUuid(entry.id) ? entry.id : undefined,
      })),
    );
    await this.recordAudit({
      userId,
      entity: 'CarbEvent',
      action: 'REPLACE',
      entityId: patientId,
      // The full count, not the truncated one: the gap between the two is the
      // symptom to look for when a diary comes back short.
      metadata: { count: entries.length },
      ...context,
    });
  }
}

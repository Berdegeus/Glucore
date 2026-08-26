import { isUuid, NotFoundError, type AuditContext, type RecordAudit } from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { toInsulinDto, type InsulinDto } from './insulin.mapper';
import type { IInsulinRepository, InsulinCreate } from './insulin.repository';
import type { InsulinInput } from './insulin.schema';

/** The diary shows a rolling window, not the whole history. */
const DIARY_PAGE = 100;

export class InsulinService {
  constructor(
    private readonly insulin: IInsulinRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  async listForUser(userId: string): Promise<InsulinDto[]> {
    const patientId = await this.patients.ensure(userId);
    const rows = await this.insulin.listRecent(patientId, DIARY_PAGE);
    return rows.map(toInsulinDto);
  }

  async createForUser(userId: string, entry: InsulinCreate, context: AuditContext): Promise<string> {
    const patientId = await this.patients.ensure(userId);
    const created = await this.insulin.create(patientId, entry);
    await this.recordAudit({
      userId,
      entity: 'InsulinEvent',
      action: 'CREATE',
      entityId: created.id,
      ...context,
    });
    return created.id;
  }

  async updateForUser(
    userId: string,
    id: string,
    entry: InsulinInput,
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    // Another patient's id updates no row and answers 404; see CarbsService.
    if ((await this.insulin.update(patientId, id, entry)) === 0) {
      throw new NotFoundError('not found');
    }
    await this.recordAudit({
      userId,
      entity: 'InsulinEvent',
      action: 'UPDATE',
      entityId: id,
      ...context,
    });
  }

  async deleteForUser(userId: string, id: string, context: AuditContext): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    if ((await this.insulin.delete(patientId, id)) === 0) {
      throw new NotFoundError('not found');
    }
    await this.recordAudit({
      userId,
      entity: 'InsulinEvent',
      action: 'DELETE',
      entityId: id,
      ...context,
    });
  }

  /** Deprecated replace-all sync; see CarbsService.replaceAllForUser. */
  async replaceAllForUser(
    userId: string,
    entries: readonly (Partial<InsulinCreate> & InsulinInput)[],
    context: AuditContext,
  ): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    await this.insulin.replaceAll(
      patientId,
      entries.slice(0, DIARY_PAGE).map((entry) => ({
        ...entry,
        id: isUuid(entry.id) ? entry.id : undefined,
      })),
    );
    await this.recordAudit({
      userId,
      entity: 'InsulinEvent',
      action: 'REPLACE',
      entityId: patientId,
      metadata: { count: entries.length },
      ...context,
    });
  }
}

import type { AuditContext, RecordAudit } from '@glucore/shared';

import type { CreatePatientInput, IPatientRepository, UpdatePatientInput } from './patient.repository';
import { toPatientDto, type PatientDto } from './patient.mapper';

export type { CreatePatientInput, UpdatePatientInput };

/**
 * The half of `PatientService` that the gateway calls over `/internal/patients`.
 *
 * `toPatientDto` and `ensure` predate this class — this is their first real
 * caller (see the comment `toPatientDto` used to carry: "nothing calls this
 * today").
 */
export class PatientService {
  constructor(
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  async getForUser(userId: string): Promise<PatientDto> {
    await this.patients.ensure(userId);
    return toPatientDto(await this.patients.findByUserId(userId));
  }

  /** Used by the gateway's registration saga. Idempotent: `ensure` already ran is fine. */
  async createFromRegistration(
    userId: string,
    input: CreatePatientInput,
    audit: AuditContext,
  ): Promise<void> {
    await this.patients.createWithDefaults(userId, input);
    await this.recordAudit({
      userId,
      entity: 'Patient',
      action: 'CREATE',
      entityId: userId,
      ...audit,
    });
  }

  async update(userId: string, input: UpdatePatientInput, audit: AuditContext): Promise<void> {
    await this.patients.ensure(userId);
    await this.patients.update(userId, input);
    await this.recordAudit({
      userId,
      entity: 'Patient',
      action: 'UPDATE',
      entityId: userId,
      metadata: { changed: Object.keys(input) },
      ...audit,
    });
  }

  /** Used by the gateway's saga compensation and by `DELETE /account`. Idempotent. */
  async deleteByUserId(userId: string): Promise<void> {
    await this.patients.deleteByUserId(userId);
  }
}

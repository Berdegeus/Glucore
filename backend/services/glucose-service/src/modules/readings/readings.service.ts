import type { AuditContext, RecordAudit } from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { toReadingDto, type ReadingDto } from './readings.mapper';
import type { IReadingRepository } from './readings.repository';
import type { ReadingInput } from './readings.schema';

/**
 * A day of CGM samples at the 5-minute cadence the sensors use. Bounds both the
 * read and the batch write, so neither a long-offline device nor a crafted
 * payload can turn one request into an unbounded transaction.
 */
const ONE_DAY_OF_SAMPLES = 288;

export class ReadingsService {
  constructor(
    private readonly readings: IReadingRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  async listForUser(userId: string): Promise<ReadingDto[]> {
    const patientId = await this.patients.ensure(userId);
    const rows = await this.readings.listRecent(patientId, ONE_DAY_OF_SAMPLES);
    return rows.map(toReadingDto);
  }

  async syncForUser(userId: string, readings: readonly ReadingInput[]): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    await this.readings.upsertMany(patientId, readings.slice(0, ONE_DAY_OF_SAMPLES));
  }

  async clearForUser(userId: string, context: AuditContext): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    await this.readings.deleteAll(patientId);
    await this.recordAudit({
      userId,
      entity: 'GlucoseReading',
      action: 'DELETE',
      entityId: patientId,
      ...context,
    });
  }
}

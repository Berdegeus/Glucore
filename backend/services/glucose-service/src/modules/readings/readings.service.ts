import { parsePageQuery, type AuditContext, type RecordAudit } from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { toReadingDto, type ReadingDto } from './readings.mapper';
import type { IReadingRepository } from './readings.repository';
import type { ReadingInput } from './readings.schema';

/**
 * Most readings one GET returns, newest first, and the default when `limit` is
 * absent. It is a safety bound, not a retention policy: ~17 days at the
 * 5-minute cadence the app uploads, which covers the 14-day window it keeps. A
 * caller that needs more asks again with `before`. The batch write is bounded
 * separately by `MAX_READING_BATCH`, which rejects instead of truncating.
 */
export const MAX_READ_ROWS = 5000;

export class ReadingsService {
  constructor(
    private readonly readings: IReadingRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
  ) {}

  async listForUser(
    userId: string,
    query: { from?: unknown; before?: unknown; limit?: unknown } = {},
  ): Promise<ReadingDto[]> {
    // Validated before the patient is ensured: a bad cursor must not create rows.
    const page = parsePageQuery(query, {
      defaultLimit: MAX_READ_ROWS,
      maxLimit: MAX_READ_ROWS,
      from: true,
    });
    const patientId = await this.patients.ensure(userId);
    const rows = await this.readings.listPage(patientId, page);
    return rows.map(toReadingDto);
  }

  async syncForUser(userId: string, readings: readonly ReadingInput[]): Promise<void> {
    const patientId = await this.patients.ensure(userId);
    await this.readings.upsertMany(patientId, readings);
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

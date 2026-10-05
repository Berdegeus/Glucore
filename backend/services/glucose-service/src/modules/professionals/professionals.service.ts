import { NotFoundError } from '@glucore/shared';

import type { IProfessionalRepository, ProfessionalSource } from './professionals.repository';
import type { ProfessionalInput } from './professionals.schema';

export interface ProfessionalDto {
  userId: string;
  licenseNumber: string;
  specialty: string;
}

const toDto = (row: ProfessionalSource): ProfessionalDto => ({
  userId: row.userId,
  licenseNumber: row.licenseNumber,
  specialty: row.specialty,
});

/** The half of professional registration that lives in the clinical database. */
export class ProfessionalsService {
  constructor(private readonly professionals: IProfessionalRepository) {}

  /** Used by the gateway's registration saga. Idempotent: a repeat returns the stored profile. */
  async create(userId: string, input: ProfessionalInput): Promise<ProfessionalDto> {
    return toDto(await this.professionals.createIfAbsent(userId, input));
  }

  async getForUser(userId: string): Promise<ProfessionalDto> {
    const row = await this.professionals.findByUserId(userId);
    if (!row) throw new NotFoundError('Professional profile not found');
    return toDto(row);
  }

  /** Used by the saga's compensation and by account deletion. Idempotent. */
  async deleteByUserId(userId: string): Promise<void> {
    await this.professionals.deleteByUserId(userId);
  }
}

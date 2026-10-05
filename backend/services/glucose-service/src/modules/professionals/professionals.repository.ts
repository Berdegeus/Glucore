import { Prisma, type PrismaClient } from '@prisma/client';

import type { ProfessionalInput } from './professionals.schema';

export interface ProfessionalSource {
  userId: string;
  licenseNumber: string;
  specialty: string;
}

/**
 * Professional profile storage. There is no `User` table in this database, so
 * the profile's key is the account id that arrives in the verified internal
 * token; the `DashboardAccessGrant` rows that reference it go with it
 * (`onDelete: Cascade`, CON-11).
 */
export interface IProfessionalRepository {
  /**
   * Creates the profile, or returns the one that already exists untouched:
   * the gateway saga may retry after a lost response (REG-04).
   */
  createIfAbsent(userId: string, input: ProfessionalInput): Promise<ProfessionalSource>;
  findByUserId(userId: string): Promise<ProfessionalSource | null>;
  /** Idempotent: deleting an id that no longer exists is a success, not a 404. */
  deleteByUserId(userId: string): Promise<void>;
}

export class PrismaProfessionalRepository implements IProfessionalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createIfAbsent(userId: string, input: ProfessionalInput): Promise<ProfessionalSource> {
    return this.prisma.healthProfessional.upsert({
      where: { userId },
      update: {},
      create: { userId, licenseNumber: input.licenseNumber, specialty: input.specialty },
    });
  }

  findByUserId(userId: string): Promise<ProfessionalSource | null> {
    return this.prisma.healthProfessional.findUnique({ where: { userId } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await this.prisma.healthProfessional.delete({ where: { userId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return;
      throw error;
    }
  }
}

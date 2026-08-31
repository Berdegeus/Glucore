import type { PrismaClient } from '@prisma/client';

/**
 * Patient row access shared by every module.
 *
 * Every clinical write is scoped by patient, and the patient row is created
 * lazily on first use rather than at registration, so all six modules depend on
 * `ensure`. They share one instance, wired in the composition root.
 */
export interface IPatientRepository {
  /**
   * Returns the patient id for an account, creating the row if this is the
   * first write. Idempotent: concurrent syncs from two devices converge.
   */
  ensure(userId: string): Promise<string>;
}

export class PrismaPatientRepository implements IPatientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensure(userId: string): Promise<string> {
    const patient = await this.prisma.patient.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return patient.userId;
  }
}

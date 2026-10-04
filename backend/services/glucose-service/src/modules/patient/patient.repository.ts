import { Prisma, type PrismaClient } from '@prisma/client';

import type { PatientSource } from './patient.mapper';

export interface CreatePatientInput {
  birthDate?: Date | null;
  diabetesType?: string | null;
  weightKg?: number | null;
  targetRangeMin?: number;
  targetRangeMax?: number;
}

export interface UpdatePatientInput {
  birthDate?: Date | null;
  diabetesType?: string | null;
  weightKg?: number | null;
  targetRangeMin?: number;
  targetRangeMax?: number;
}

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
  findByUserId(userId: string): Promise<PatientSource | null>;
  /**
   * Creates the Patient row and its AlertThresholdConfig together, seeded from
   * the same target range — mirrors what the monolith did in one transaction
   * before the split. Used by the gateway's registration saga; `ensure` stays
   * the lazy backstop for a client that syncs data before this ever runs.
   */
  createWithDefaults(userId: string, input: CreatePatientInput): Promise<void>;
  /** Also re-syncs AlertThresholdConfig when the target range moves. */
  update(userId: string, input: UpdatePatientInput): Promise<void>;
  /** Idempotent: deleting an id that no longer exists is a success, not a 404. */
  deleteByUserId(userId: string): Promise<void>;
}

const DEFAULT_TARGET_MIN = 80;
const DEFAULT_TARGET_MAX = 180;

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

  findByUserId(userId: string): Promise<PatientSource | null> {
    return this.prisma.patient.findUnique({ where: { userId } });
  }

  async createWithDefaults(userId: string, input: CreatePatientInput): Promise<void> {
    const targetRangeMin = input.targetRangeMin ?? DEFAULT_TARGET_MIN;
    const targetRangeMax = input.targetRangeMax ?? DEFAULT_TARGET_MAX;

    await this.prisma.$transaction([
      this.prisma.patient.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          birthDate: input.birthDate ?? undefined,
          diabetesType: input.diabetesType ?? undefined,
          weightKg: input.weightKg ?? undefined,
          targetRangeMin,
          targetRangeMax,
        },
      }),
      this.prisma.alertThresholdConfig.upsert({
        where: { patientId: userId },
        update: {},
        create: { patientId: userId, lowGlucoseMgDl: targetRangeMin, highGlucoseMgDl: targetRangeMax },
      }),
    ]);
  }

  async update(userId: string, input: UpdatePatientInput): Promise<void> {
    const patientData: Prisma.PatientUpdateInput = {};
    if (input.birthDate !== undefined) patientData.birthDate = input.birthDate;
    if (input.diabetesType !== undefined) patientData.diabetesType = input.diabetesType;
    if (input.weightKg !== undefined) patientData.weightKg = input.weightKg;
    if (input.targetRangeMin !== undefined) patientData.targetRangeMin = input.targetRangeMin;
    if (input.targetRangeMax !== undefined) patientData.targetRangeMax = input.targetRangeMax;

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (Object.keys(patientData).length > 0) {
      operations.push(this.prisma.patient.update({ where: { userId }, data: patientData }));
    }

    if (input.targetRangeMin !== undefined || input.targetRangeMax !== undefined) {
      operations.push(
        this.prisma.alertThresholdConfig.upsert({
          where: { patientId: userId },
          update: {
            ...(input.targetRangeMin !== undefined ? { lowGlucoseMgDl: input.targetRangeMin } : {}),
            ...(input.targetRangeMax !== undefined ? { highGlucoseMgDl: input.targetRangeMax } : {}),
          },
          create: {
            patientId: userId,
            lowGlucoseMgDl: input.targetRangeMin ?? DEFAULT_TARGET_MIN,
            highGlucoseMgDl: input.targetRangeMax ?? DEFAULT_TARGET_MAX,
          },
        }),
      );
    }

    if (operations.length > 0) await this.prisma.$transaction(operations);
  }

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await this.prisma.patient.delete({ where: { userId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return;
      throw error;
    }
  }
}

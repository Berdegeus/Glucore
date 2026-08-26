import type { AlertThresholdConfig, PrismaClient } from '@prisma/client';

export interface ThresholdValues {
  lowGlucoseMgDl: number;
  highGlucoseMgDl: number;
}

export interface ISettingsRepository {
  find(patientId: string): Promise<AlertThresholdConfig | null>;
  upsert(patientId: string, values: ThresholdValues): Promise<void>;
}

export class PrismaSettingsRepository implements ISettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  find(patientId: string): Promise<AlertThresholdConfig | null> {
    return this.prisma.alertThresholdConfig.findUnique({ where: { patientId } });
  }

  async upsert(patientId: string, values: ThresholdValues): Promise<void> {
    await this.prisma.alertThresholdConfig.upsert({
      where: { patientId },
      update: values,
      create: { patientId, ...values },
    });
  }
}

import type { AlertEvent, AlertType, PrismaClient } from '@prisma/client';

export interface AlertRow {
  alertType: AlertType;
  triggeredAt: Date;
}

export interface IAlertRepository {
  listRecent(patientId: string, limit: number): Promise<AlertEvent[]>;
  replaceAll(patientId: string, alerts: readonly AlertRow[]): Promise<void>;
}

export class PrismaAlertRepository implements IAlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listRecent(patientId: string, limit: number): Promise<AlertEvent[]> {
    return this.prisma.alertEvent.findMany({
      where: { patientId },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });
  }

  async replaceAll(patientId: string, alerts: readonly AlertRow[]): Promise<void> {
    await this.prisma.alertEvent.deleteMany({ where: { patientId } });
    await this.prisma.alertEvent.createMany({
      data: alerts.map((alert) => ({ patientId, ...alert })),
    });
  }
}

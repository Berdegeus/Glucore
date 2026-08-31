import type { PageQuery } from '@glucore/shared';
import type { AlertEvent, AlertType, PrismaClient } from '@prisma/client';

/** An alert in DB vocabulary — the mapper is what gets it here from `AlertInput`. */
export interface AlertRow {
  alertType: AlertType;
  triggeredAt: Date;
}

/** A create carries an optional client-minted id; an update never does. */
export type AlertCreate = AlertRow & { id?: string };

export interface IAlertRepository {
  /** Newest first, strictly older than `query.before`, at most `query.limit` rows. */
  listPage(patientId: string, query: PageQuery): Promise<AlertEvent[]>;
  create(patientId: string, entry: AlertCreate): Promise<AlertEvent>;
  /** Scoped by patient, so an id belonging to someone else updates nothing. */
  update(patientId: string, id: string, entry: AlertRow): Promise<number>;
  delete(patientId: string, id: string): Promise<number>;
  replaceAll(patientId: string, alerts: readonly AlertCreate[]): Promise<void>;
}

export class PrismaAlertRepository implements IAlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listPage(patientId: string, { before, limit }: PageQuery): Promise<AlertEvent[]> {
    return this.prisma.alertEvent.findMany({
      where: {
        patientId,
        ...(before === undefined ? {} : { triggeredAt: { lt: new Date(before) } }),
      },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });
  }

  create(patientId: string, entry: AlertCreate): Promise<AlertEvent> {
    return this.prisma.alertEvent.create({
      data: {
        ...(entry.id ? { id: entry.id } : {}),
        patientId,
        alertType: entry.alertType,
        triggeredAt: entry.triggeredAt,
      },
    });
  }

  async update(patientId: string, id: string, entry: AlertRow): Promise<number> {
    const result = await this.prisma.alertEvent.updateMany({
      where: { id, patientId },
      data: { alertType: entry.alertType, triggeredAt: entry.triggeredAt },
    });
    return result.count;
  }

  async delete(patientId: string, id: string): Promise<number> {
    const result = await this.prisma.alertEvent.deleteMany({ where: { id, patientId } });
    return result.count;
  }

  async replaceAll(patientId: string, alerts: readonly AlertCreate[]): Promise<void> {
    await this.prisma.alertEvent.deleteMany({ where: { patientId } });
    await this.prisma.alertEvent.createMany({
      data: alerts.map((alert) => ({
        ...(alert.id ? { id: alert.id } : {}),
        patientId,
        alertType: alert.alertType,
        triggeredAt: alert.triggeredAt,
      })),
    });
  }
}

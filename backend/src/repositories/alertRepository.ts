/**
 * Data access for the alert history (`AlertEvent`).
 *
 * Same shape as `carbRepository` and `insulinRepository`: the Prisma client
 * arrives by parameter (design.md "Camadas do backend"). The enum mapping the
 * route used to hold lives here, because translating a stored column into the
 * shape the API exposes is exactly what this layer does.
 *
 * The mapping is deliberately lossy in one direction, as it already was:
 * `FAST_DROP`, `FAST_RISE` and `SYNC_FAILURE` all read back as `syncFailure`,
 * and an app type nobody recognizes is stored as `SYNC_FAILURE`. Changing that
 * would change the contract the app in the field already parses.
 */

import { AlertType } from '@prisma/client';

/** The narrow slice of `prisma.alertEvent` this repository uses. */
export interface AlertPrismaClient {
  alertEvent: {
    findMany(args: {
      where: { patientId: string; triggeredAt?: { lt: Date } };
      orderBy: { triggeredAt: 'desc' };
      take: number;
    }): Promise<Array<{ id: string; alertType: AlertType; triggeredAt: Date }>>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    updateMany(args: {
      where: { id: string; patientId: string };
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
    deleteMany(args: {
      where: { id?: string; patientId: string };
    }): Promise<{ count: number }>;
    createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  };
}

/** An alert as the API exposes it. `id` is new in this release (API-01). */
export interface AlertEntry {
  id: string;
  type: string;
  timestampMs: number;
}

export interface AlertPageQuery {
  patientId: string;
  /** Exclusive upper bound, epoch ms. Absent means "from the newest". */
  before?: number;
  limit: number;
}

export interface AlertInput {
  type: string;
  timestampMs: number;
}

export function toDbAlertType(type: string): AlertType {
  switch (type) {
    case 'glucoseLow':
    case 'HYPO_RISK':
      return AlertType.HYPO_RISK;
    case 'glucoseHigh':
    case 'HYPER_RISK':
      return AlertType.HYPER_RISK;
    case 'sensorReconnected':
    case 'SENSOR_RECONNECTED':
      return AlertType.SENSOR_RECONNECTED;
    case 'syncFailure':
    case 'SYNC_FAILURE':
      return AlertType.SYNC_FAILURE;
    case 'FAST_DROP':
      return AlertType.FAST_DROP;
    case 'FAST_RISE':
      return AlertType.FAST_RISE;
    default:
      return AlertType.SYNC_FAILURE;
  }
}

export function toAppAlertType(type: AlertType): string {
  switch (type) {
    case AlertType.HYPO_RISK:
      return 'glucoseLow';
    case AlertType.HYPER_RISK:
      return 'glucoseHigh';
    case AlertType.SENSOR_RECONNECTED:
      return 'sensorReconnected';
    case AlertType.FAST_DROP:
    case AlertType.FAST_RISE:
    case AlertType.SYNC_FAILURE:
      return 'syncFailure';
  }
}

export interface AlertRepository {
  /** Newest first, strictly older than `before`, at most `limit` rows. */
  findPage(query: AlertPageQuery): Promise<AlertEntry[]>;
  /** Persists one alert, honouring a client-supplied UUID. Returns its id. */
  create(patientId: string, input: AlertInput & { id?: string }): Promise<string>;
  /** Scoped to the patient; `false` means "no such row of yours". */
  update(id: string, patientId: string, input: AlertInput): Promise<boolean>;
  /** Scoped to the patient; `false` means "no such row of yours". */
  remove(id: string, patientId: string): Promise<boolean>;
  /** Deprecated batch path: swaps the patient's whole collection. */
  replaceAll(patientId: string, entries: Array<AlertInput & { id?: string }>): Promise<void>;
}

export function createAlertRepository(client: AlertPrismaClient): AlertRepository {
  return {
    async findPage({ patientId, before, limit }) {
      const rows = await client.alertEvent.findMany({
        where: {
          patientId,
          ...(before === undefined ? {} : { triggeredAt: { lt: new Date(before) } }),
        },
        orderBy: { triggeredAt: 'desc' },
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        type: toAppAlertType(row.alertType),
        timestampMs: row.triggeredAt.getTime(),
      }));
    },

    async create(patientId, input) {
      const created = await client.alertEvent.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          patientId,
          alertType: toDbAlertType(input.type),
          triggeredAt: new Date(input.timestampMs),
        },
      });
      return created.id;
    },

    async update(id, patientId, input) {
      const result = await client.alertEvent.updateMany({
        where: { id, patientId },
        data: {
          alertType: toDbAlertType(input.type),
          triggeredAt: new Date(input.timestampMs),
        },
      });
      return result.count > 0;
    },

    async remove(id, patientId) {
      const result = await client.alertEvent.deleteMany({ where: { id, patientId } });
      return result.count > 0;
    },

    async replaceAll(patientId, entries) {
      await client.alertEvent.deleteMany({ where: { patientId } });
      await client.alertEvent.createMany({
        data: entries.map((entry) => ({
          ...(entry.id ? { id: entry.id } : {}),
          patientId,
          alertType: toDbAlertType(entry.type),
          triggeredAt: new Date(entry.timestampMs),
        })),
      });
    },
  };
}

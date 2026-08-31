/**
 * In-memory repositories for the service-layer tests.
 *
 * Hand-written fakes rather than `vi.mock`: they implement the same interfaces
 * the production classes do, so a change to an interface fails the build here
 * instead of silently leaving a mock that agrees with nothing.
 */

import type { AlertEvent, AlertType, CarbEvent, GlucoseReading, InsulinEvent } from '@prisma/client';
import type { AuditEntry, PageQuery } from '@glucore/shared';

import type { AlertCreate, IAlertRepository } from '../../src/modules/alerts/alerts.repository';
import type { CarbCreate, ICarbRepository } from '../../src/modules/carbs/carbs.repository';
import type {
  IInsulinRepository,
  InsulinCreate,
} from '../../src/modules/insulin/insulin.repository';
import type { IPatientRepository } from '../../src/modules/patient/patient.repository';
import type { IReadingRepository } from '../../src/modules/readings/readings.repository';
import type { ReadingInput } from '../../src/modules/readings/readings.schema';
import type {
  ISettingsRepository,
  ThresholdValues,
} from '../../src/modules/settings/settings.repository';

let sequence = 0;
export const nextId = (): string =>
  `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

export class FakePatientRepository implements IPatientRepository {
  readonly ensured: string[] = [];

  async ensure(userId: string): Promise<string> {
    this.ensured.push(userId);
    return userId;
  }
}

export class RecordedAudit {
  readonly entries: AuditEntry[] = [];

  record = async (entry: AuditEntry): Promise<void> => {
    this.entries.push(entry);
  };
}

export class FakeReadingRepository implements IReadingRepository {
  rows: GlucoseReading[] = [];
  lastUpsert: readonly ReadingInput[] = [];
  deleted = 0;

  async listRecent(patientId: string, limit: number): Promise<GlucoseReading[]> {
    return this.rows.filter((row) => row.patientId === patientId).slice(0, limit);
  }

  async upsertMany(_patientId: string, readings: readonly ReadingInput[]): Promise<void> {
    this.lastUpsert = readings;
  }

  async deleteAll(_patientId: string): Promise<void> {
    this.deleted += 1;
  }
}

export class FakeCarbRepository implements ICarbRepository {
  rows: CarbEvent[] = [];
  lastReplace: readonly CarbCreate[] = [];
  /** Number of rows the next update or delete should claim to have touched. */
  affected = 1;

  async listPage(patientId: string, { before, limit }: PageQuery): Promise<CarbEvent[]> {
    return this.rows
      .filter((row) => row.patientId === patientId)
      .filter((row) => before === undefined || row.eventAt.getTime() < before)
      .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())
      .slice(0, limit);
  }

  async create(patientId: string, entry: CarbCreate): Promise<CarbEvent> {
    const row = {
      id: entry.id ?? nextId(),
      patientId,
      eventAt: new Date(entry.timeMs),
      carbsGrams: entry.grams,
      description: entry.description,
    } as unknown as CarbEvent;
    this.rows.push(row);
    return row;
  }

  async update(): Promise<number> {
    return this.affected;
  }

  async delete(): Promise<number> {
    return this.affected;
  }

  async replaceAll(_patientId: string, entries: readonly CarbCreate[]): Promise<void> {
    this.lastReplace = entries;
  }
}

export class FakeInsulinRepository implements IInsulinRepository {
  rows: InsulinEvent[] = [];
  lastReplace: readonly InsulinCreate[] = [];
  affected = 1;

  async listPage(patientId: string, { before, limit }: PageQuery): Promise<InsulinEvent[]> {
    return this.rows
      .filter((row) => row.patientId === patientId)
      .filter((row) => before === undefined || row.eventAt.getTime() < before)
      .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())
      .slice(0, limit);
  }

  async create(patientId: string, entry: InsulinCreate): Promise<InsulinEvent> {
    const row = {
      id: entry.id ?? nextId(),
      patientId,
      eventAt: new Date(entry.timeMs),
      doseUnits: entry.units,
      insulinType: entry.type,
      dayOfWeek: entry.dayOfWeek ?? '',
      description: null,
    } as unknown as InsulinEvent;
    this.rows.push(row);
    return row;
  }

  async update(): Promise<number> {
    return this.affected;
  }

  async delete(): Promise<number> {
    return this.affected;
  }

  async replaceAll(_patientId: string, entries: readonly InsulinCreate[]): Promise<void> {
    this.lastReplace = entries;
  }
}

export class FakeAlertRepository implements IAlertRepository {
  rows: AlertEvent[] = [];
  lastReplace: readonly AlertCreate[] = [];
  affected = 1;

  async listPage(patientId: string, { before, limit }: PageQuery): Promise<AlertEvent[]> {
    return this.rows
      .filter((row) => row.patientId === patientId)
      .filter((row) => before === undefined || row.triggeredAt.getTime() < before)
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
      .slice(0, limit);
  }

  async create(patientId: string, entry: AlertCreate): Promise<AlertEvent> {
    const row = alertRow(patientId, entry.alertType, entry.triggeredAt);
    if (entry.id) row.id = entry.id;
    this.rows.push(row);
    return row;
  }

  async update(): Promise<number> {
    return this.affected;
  }

  async delete(): Promise<number> {
    return this.affected;
  }

  async replaceAll(_patientId: string, alerts: readonly AlertCreate[]): Promise<void> {
    this.lastReplace = alerts;
  }
}

export class FakeSettingsRepository implements ISettingsRepository {
  stored: ThresholdValues | null = null;
  lastUpsert: ThresholdValues | null = null;

  async find(patientId: string) {
    return this.stored === null
      ? null
      : ({ patientId, ...this.stored } as Awaited<ReturnType<ISettingsRepository['find']>>);
  }

  async upsert(_patientId: string, values: ThresholdValues): Promise<void> {
    this.lastUpsert = values;
    this.stored = values;
  }
}

/** Builds a GlucoseReading row without going through Prisma. */
export function readingRow(patientId: string, overrides: Partial<GlucoseReading> = {}): GlucoseReading {
  return {
    id: nextId(),
    patientId,
    sensorSessionId: null,
    recordedAt: new Date('2026-08-25T12:00:00.000Z'),
    valueMgDl: 120,
    trend: 'stable',
    trendRate: 0,
    source: 'sensor',
    isManual: false,
    alarmCode: null,
    ...overrides,
  } as GlucoseReading;
}

/** Builds an AlertEvent row without going through Prisma. */
export function alertRow(patientId: string, alertType: AlertType, triggeredAt: Date): AlertEvent {
  return {
    id: nextId(),
    patientId,
    glucosePredictionId: null,
    triggeredAt,
    resolvedAt: null,
    alertType,
    message: '',
    acknowledged: false,
  } as AlertEvent;
}

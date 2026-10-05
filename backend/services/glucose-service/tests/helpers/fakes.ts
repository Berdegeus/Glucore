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
import type {
  CreatePatientInput,
  IPatientRepository,
  UpdatePatientInput,
} from '../../src/modules/patient/patient.repository';
import type { PatientSource } from '../../src/modules/patient/patient.mapper';
import type { IReadingRepository } from '../../src/modules/readings/readings.repository';
import type { ReadingInput } from '../../src/modules/readings/readings.schema';
import type {
  ISettingsRepository,
  ThresholdValues,
} from '../../src/modules/settings/settings.repository';
import type { DateRange, IDashboardRepository } from '../../src/modules/dashboard/dashboard.repository';
import type { TimeZoneChecker } from '../../src/modules/dashboard/dashboard.timezones';
import type {
  AgpPointDto,
  AlertsByTypeDto,
  DailyBucketDto,
  DashboardTotals,
  ExcursionDto,
  HeatCellDto,
  InsulinByTypeDto,
  PeriodMetricsDto,
  ZoneDistributionDto,
} from '../../src/modules/dashboard/dashboard.mapper';

let sequence = 0;
export const nextId = (): string =>
  `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

export class FakePatientRepository implements IPatientRepository {
  readonly ensured: string[] = [];
  readonly rows = new Map<string, PatientSource>();
  deletedUserIds: string[] = [];

  async ensure(userId: string): Promise<string> {
    this.ensured.push(userId);
    return userId;
  }

  async findByUserId(userId: string): Promise<PatientSource | null> {
    return this.rows.get(userId) ?? null;
  }

  async createWithDefaults(userId: string, input: CreatePatientInput): Promise<void> {
    this.rows.set(userId, {
      birthDate: input.birthDate ?? null,
      diabetesType: input.diabetesType ?? null,
      weightKg: input.weightKg ?? null,
      targetRangeMin: input.targetRangeMin ?? 80,
      targetRangeMax: input.targetRangeMax ?? 180,
    });
  }

  async update(userId: string, input: UpdatePatientInput): Promise<void> {
    const existing = this.rows.get(userId);
    this.rows.set(userId, {
      birthDate: input.birthDate !== undefined ? input.birthDate : (existing?.birthDate ?? null),
      diabetesType:
        input.diabetesType !== undefined ? input.diabetesType : (existing?.diabetesType ?? null),
      weightKg: input.weightKg !== undefined ? input.weightKg : (existing?.weightKg ?? null),
      targetRangeMin: input.targetRangeMin ?? existing?.targetRangeMin ?? 80,
      targetRangeMax: input.targetRangeMax ?? existing?.targetRangeMax ?? 180,
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.deletedUserIds.push(userId);
    this.rows.delete(userId);
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

/**
 * Fake dashboard repository — every method returns whatever the test staged in
 * the corresponding field. The real repository's job is entirely SQL (raw
 * queries + groupBy + a stored procedure), so there is no meaningful in-memory
 * reimplementation of it; this fake only exists to isolate `DashboardService`'s
 * own logic (threshold resolution, range building) from that SQL.
 */
export class FakeDashboardRepository implements IDashboardRepository {
  thresholdConfig: { lowGlucoseMgDl: number; highGlucoseMgDl: number } | null = null;
  totals: DashboardTotals = { readingsCount: 0, carbEntries: 0, insulinEntries: 0, alertsCount: 0 };
  periodMetrics: PeriodMetricsDto = {
    avgGlucose: null,
    gmiPercent: null,
    cvPercent: null,
    timeInRangePercent: null,
    readingsCount: 0,
  };
  zoneDistribution: ZoneDistributionDto = { veryLow: 0, low: 0, target: 0, high: 0, veryHigh: 0 };
  agp: AgpPointDto[] = [];
  heatmap: HeatCellDto[] = [];
  dailyBuckets: DailyBucketDto[] = [];
  insulinByType: InsulinByTypeDto[] = [];
  alertsByType: AlertsByTypeDto[] = [];
  excursions: ExcursionDto[] = [];

  /** Every range this fake was called with, in call order — asserts what the service built. */
  readonly rangesSeen: DateRange[] = [];
  readonly thresholdsSeen: Array<{ low: number; high: number }> = [];

  /** Plain UTC arithmetic; the real window-in-zone logic is covered against Postgres. */
  async resolveBounds(fromDate: Date, toDate: Date): Promise<DateRange> {
    return { from: fromDate, toExclusive: new Date(toDate.getTime() + 24 * 60 * 60 * 1000) };
  }

  async getThresholdConfig(
    _patientId: string,
  ): Promise<{ lowGlucoseMgDl: number; highGlucoseMgDl: number } | null> {
    return this.thresholdConfig;
  }

  async getTotals(_patientId: string, range: DateRange): Promise<DashboardTotals> {
    this.rangesSeen.push(range);
    return this.totals;
  }

  async getInsulinByType(): Promise<InsulinByTypeDto[]> {
    return this.insulinByType;
  }

  async getAlertsByType(): Promise<AlertsByTypeDto[]> {
    return this.alertsByType;
  }

  async getPeriodMetrics(
    _patientId: string,
    _range: DateRange,
    low: number,
    high: number,
  ): Promise<PeriodMetricsDto> {
    this.thresholdsSeen.push({ low, high });
    return this.periodMetrics;
  }

  async getZoneDistribution(): Promise<ZoneDistributionDto> {
    return this.zoneDistribution;
  }

  async getAgp(): Promise<AgpPointDto[]> {
    return this.agp;
  }

  async getHeatmap(): Promise<HeatCellDto[]> {
    return this.heatmap;
  }

  async getDailyBuckets(): Promise<DailyBucketDto[]> {
    return this.dailyBuckets;
  }

  async getExcursions(): Promise<ExcursionDto[]> {
    return this.excursions;
  }
}

/** Knows only the zones it is given — keeps `DashboardService` tests off Postgres. */
export class FakeTimeZoneChecker implements TimeZoneChecker {
  constructor(private readonly known: string[] = ['UTC', 'America/Sao_Paulo']) {}

  async isValid(name: string): Promise<boolean> {
    return this.known.includes(name);
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

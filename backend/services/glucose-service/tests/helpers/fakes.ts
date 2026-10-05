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
import type {
  ActiveGrantListItem,
  CreatedInvite,
  GrantSource,
  ISharingRepository,
  RedeemOutcome,
} from '../../src/modules/sharing/sharing.repository';
import type { IReadingRepository } from '../../src/modules/readings/readings.repository';
import type { ReadingInput } from '../../src/modules/readings/readings.schema';
import type {
  ISettingsRepository,
  ThresholdValues,
} from '../../src/modules/settings/settings.repository';
import type { DateRange, IDashboardRepository } from '../../src/modules/dashboard/dashboard.repository';
import type { HypoHourCount } from '../../src/modules/professional/professional.hypo';
import type { GrantedPatientPage, PatientPageRequest } from '../../src/modules/professional/professional.listing';
import type { PatientMetrics } from '../../src/modules/professional/professional.mapper';
import type { ICohortRepository } from '../../src/modules/professional/professional.repository';
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
  lastReadingAt: string | null = null;
  agp: AgpPointDto[] = [];
  heatmap: HeatCellDto[] = [];
  dailyBuckets: DailyBucketDto[] = [];
  insulinByType: InsulinByTypeDto[] = [];
  alertsByType: AlertsByTypeDto[] = [];
  excursions: ExcursionDto[] = [];

  /** Stage this to make `resolveBounds` answer a window that is not plain UTC midnight-to-midnight. */
  bounds: DateRange | null = null;

  /** Every range this fake was called with, in call order — asserts what the service built. */
  readonly rangesSeen: DateRange[] = [];
  readonly thresholdsSeen: Array<{ low: number; high: number }> = [];
  /** The patient id each `getTotals` call came with. */
  readonly patientIdsSeen: string[] = [];
  /** The zone each zone-aware method was called with, keyed by method name. */
  readonly tzSeen: Record<'resolveBounds' | 'getAgp' | 'getHeatmap' | 'getDailyBuckets', string[]> = {
    resolveBounds: [],
    getAgp: [],
    getHeatmap: [],
    getDailyBuckets: [],
  };

  /** Plain UTC arithmetic unless `bounds` is staged; the real window-in-zone logic is covered against Postgres. */
  async resolveBounds(fromDate: Date, toDate: Date, tz: string): Promise<DateRange> {
    this.tzSeen.resolveBounds.push(tz);
    return this.bounds ?? { from: fromDate, toExclusive: new Date(toDate.getTime() + 24 * 60 * 60 * 1000) };
  }

  async getThresholdConfig(
    _patientId: string,
  ): Promise<{ lowGlucoseMgDl: number; highGlucoseMgDl: number } | null> {
    return this.thresholdConfig;
  }

  async getTotals(patientId: string, range: DateRange): Promise<DashboardTotals> {
    this.patientIdsSeen.push(patientId);
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

  async getLastReadingAt(): Promise<string | null> {
    return this.lastReadingAt;
  }

  async getAgp(_patientId: string, _range: DateRange, tz: string): Promise<AgpPointDto[]> {
    this.tzSeen.getAgp.push(tz);
    return this.agp;
  }

  async getHeatmap(_patientId: string, _range: DateRange, tz: string): Promise<HeatCellDto[]> {
    this.tzSeen.getHeatmap.push(tz);
    return this.heatmap;
  }

  async getDailyBuckets(
    _patientId: string,
    _range: DateRange,
    _low: number,
    _high: number,
    tz: string,
  ): Promise<DailyBucketDto[]> {
    this.tzSeen.getDailyBuckets.push(tz);
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

/**
 * Scripted sharing repository: the SQL (atomic redeem, partial indexes) is
 * covered against Postgres, so this fake only records what the service asked
 * for and answers what the test staged. `grants` is the one piece of state it
 * keeps, with the real active rule, so the grant policy can be exercised at the
 * boundaries of `expiresAt`.
 */
export class FakeSharingRepository implements ISharingRepository {
  readonly createCalls: Array<{ patientId: string; codeHash: string; expiresAt: Date; now?: Date }> = [];
  readonly redeemCalls: Array<{ codeHash: string; professionalId: string; now: Date }> = [];
  readonly revokeCalls: Array<{ patientId: string; grantId: string; now: Date }> = [];
  readonly listCalls: Array<{ patientId: string; now: Date }> = [];

  created: CreatedInvite = { inviteId: nextId(), invalidatedInviteId: null };
  redeemOutcome: RedeemOutcome = { redeemed: false };
  /** Thrown by `redeemInvite` when set. */
  redeemError: Error | null = null;
  listed: ActiveGrantListItem[] = [];
  revoked: { professionalId: string } | null = null;
  grants: GrantSource[] = [];

  async createInvite(patientId: string, codeHash: string, expiresAt: Date, now?: Date): Promise<CreatedInvite> {
    this.createCalls.push({ patientId, codeHash, expiresAt, now });
    return this.created;
  }

  async redeemInvite(codeHash: string, professionalId: string, now: Date): Promise<RedeemOutcome> {
    this.redeemCalls.push({ codeHash, professionalId, now });
    if (this.redeemError) throw this.redeemError;
    return this.redeemOutcome;
  }

  async findActiveGrant(professionalId: string, patientId: string, now: Date): Promise<GrantSource | null> {
    return (
      this.grants.find(
        (grant) =>
          grant.healthProfessionalId === professionalId &&
          grant.patientId === patientId &&
          grant.revokedAt === null &&
          (grant.expiresAt === null || grant.expiresAt > now),
      ) ?? null
    );
  }

  async listActiveGrants(patientId: string, now: Date): Promise<ActiveGrantListItem[]> {
    this.listCalls.push({ patientId, now });
    return this.listed;
  }

  async revokeGrant(
    patientId: string,
    grantId: string,
    now: Date,
  ): Promise<{ professionalId: string } | null> {
    this.revokeCalls.push({ patientId, grantId, now });
    return this.revoked;
  }

  async isGrantActive(professionalId: string, patientId: string, now: Date): Promise<boolean> {
    return (await this.findActiveGrant(professionalId, patientId, now)) !== null;
  }
}

/**
 * Scripted portfolio repository: the SQL is covered against Postgres, so this
 * fake only answers what the test staged and records what the service asked.
 * `granted` is the professional's active patients in grant order; paging is the
 * real arithmetic so a test can see the page and cap the service requested.
 */
export class FakeCohortRepository implements ICohortRepository {
  granted: string[] = [];
  metrics: PatientMetrics[] = [];
  hypoHours: HypoHourCount[] = [];

  readonly listCalls: Array<{ professionalId: string; now: Date; request?: PatientPageRequest }> = [];
  readonly metricsCalls: Array<{ ids: readonly string[]; range: DateRange }> = [];
  readonly hypoCalls: Array<{ ids: readonly string[]; range: DateRange; tz: string }> = [];

  async listGrantedPatientIds(
    professionalId: string,
    now: Date,
    request?: PatientPageRequest,
  ): Promise<GrantedPatientPage> {
    this.listCalls.push({ professionalId, now, request });
    const { page = 1, limit = 50 } = request ?? {};
    return { ids: this.granted.slice((page - 1) * limit, page * limit), total: this.granted.length };
  }

  async getPatientMetrics(ids: readonly string[], range: DateRange): Promise<PatientMetrics[]> {
    this.metricsCalls.push({ ids, range });
    return this.metrics.filter((row) => ids.includes(row.patientId));
  }

  async getHypoStartHours(ids: readonly string[], range: DateRange, tz: string): Promise<HypoHourCount[]> {
    this.hypoCalls.push({ ids, range, tz });
    return this.hypoHours;
  }
}

/** Builds the metrics of one patient; override only what the test is about. */
export function metricsRow(patientId: string, overrides: Partial<PatientMetrics> = {}): PatientMetrics {
  return {
    patientId,
    lastReadingAt: '2026-09-01T11:00:00.000Z',
    timeInRangePercent: 70,
    gmiPercent: 7,
    cvPercent: 30,
    readingsCount: 0,
    zoneDistribution: { veryLow: 0, low: 0, target: 100, high: 0, veryHigh: 0 },
    hypoEpisodes: 0,
    alertsCount: 0,
    ...overrides,
  };
}

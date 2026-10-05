import { BadRequestError, type AuditContext, type RecordAudit } from '@glucore/shared';

import type { DashboardSummaryDto } from '../dashboard/dashboard.mapper';
import type { DateRange, IDashboardRepository } from '../dashboard/dashboard.repository';
import { INVALID_TIMEZONE, type DashboardQuery } from '../dashboard/dashboard.schema';
import type { DashboardService } from '../dashboard/dashboard.service';
import type { TimeZoneChecker } from '../dashboard/dashboard.timezones';
import type { GrantPolicy } from '../sharing/grantPolicy';
import { MAX_PATIENT_PAGE_LIMIT } from './professional.listing';
import {
  buildCohortSummary,
  toPatientListItem,
  type CohortSummaryDto,
  type PatientListDto,
} from './professional.mapper';
import type { ICohortRepository } from './professional.repository';
import type { CohortQuery, PatientListQuery } from './professional.schema';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What the audit trail records as the route: the pattern, never the concrete ids or the query. */
export const AUDIT_ROUTES = {
  list: '/professional/patients',
  patientSummary: '/professional/patients/:id/summary',
  cohortSummary: '/professional/cohort/summary',
} as const;

/** The calendar day it is in `tz` at `now`, as a UTC-midnight `Date` (the shape `resolveBounds` takes). */
function localCalendarDay(now: Date, tz: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    // Postgres knew the name but this runtime's ICU does not: the zone is unusable here all the same.
    throw new BadRequestError(`tz "${tz}" is not a known time zone`, INVALID_TIMEZONE);
  }
  const part = (type: string) => parts.find((candidate) => candidate.type === type)!.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
}

/**
 * The professional's portfolio: who they follow, how each patient is doing, and
 * the aggregates over all of them. Every read is limited to the token's active
 * grants and audited with the professional, the patient (when it is one) and the
 * route, never a glucose value or a name (PRO-11, PRO-12, PRO-14).
 */
export class ProfessionalService {
  constructor(
    private readonly cohort: ICohortRepository,
    private readonly bounds: Pick<IDashboardRepository, 'resolveBounds'>,
    private readonly dashboard: Pick<DashboardService, 'getSummary'>,
    private readonly grants: Pick<GrantPolicy, 'assertActive'>,
    private readonly timeZones: TimeZoneChecker,
    private readonly recordAudit: RecordAudit,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async listPatients(
    professionalId: string,
    query: PatientListQuery,
    context: AuditContext,
  ): Promise<PatientListDto> {
    const range = await this.resolvePeriod(query);
    const { ids, total } = await this.cohort.listGrantedPatientIds(professionalId, this.clock(), {
      page: query.page,
      limit: query.limit,
    });
    const metrics = await this.cohort.getPatientMetrics(ids, range);

    // The repository answers unordered; the page keeps the order the grants gave.
    const byId = new Map(metrics.map((row) => [row.patientId, row]));
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toPatientListItem(row, query.days)] : [];
    });

    await this.audit(professionalId, 'READ_LIST', null, AUDIT_ROUTES.list, items.length, context);
    return { items, page: query.page, limit: query.limit, total };
  }

  /** The patient's own dashboard summary, once the professional is known to hold an active grant. */
  async patientSummary(
    professionalId: string,
    patientId: string,
    query: DashboardQuery,
    context: AuditContext,
  ): Promise<DashboardSummaryDto> {
    await this.grants.assertActive(professionalId, patientId);
    const summary = await this.dashboard.getSummary(patientId, query);

    await this.audit(professionalId, 'READ', patientId, AUDIT_ROUTES.patientSummary, undefined, context);
    return summary;
  }

  /**
   * Aggregates over every patient with an active grant, the oldest 200 links at
   * most (`MAX_PATIENT_PAGE_LIMIT`): past that the answer stays valid, it just
   * leaves the newest patients out.
   */
  async cohortSummary(
    professionalId: string,
    query: CohortQuery,
    context: AuditContext,
  ): Promise<CohortSummaryDto> {
    const range = await this.resolvePeriod(query);
    const now = this.clock();
    const { ids } = await this.cohort.listGrantedPatientIds(professionalId, now, {
      page: 1,
      limit: MAX_PATIENT_PAGE_LIMIT,
    });

    const [metrics, hypoHours] = await Promise.all([
      this.cohort.getPatientMetrics(ids, range),
      this.cohort.getHypoStartHours(ids, range, query.tz),
    ]);
    const summary = buildCohortSummary(metrics, hypoHours, now);

    await this.audit(
      professionalId,
      'READ_COHORT',
      null,
      AUDIT_ROUTES.cohortSummary,
      summary.patientCount,
      context,
    );
    return summary;
  }

  /** The last `days` calendar days ending today in `tz`, as the UTC window the queries take. */
  private async resolvePeriod({ days, tz }: CohortQuery): Promise<DateRange> {
    if (!(await this.timeZones.isValid(tz))) {
      throw new BadRequestError(`tz "${tz}" is not a known time zone`, INVALID_TIMEZONE);
    }
    const to = localCalendarDay(this.clock(), tz);
    const from = new Date(to.getTime() - (days - 1) * MS_PER_DAY);
    return this.bounds.resolveBounds(from, to, tz);
  }

  /**
   * Metadata is the route and, for a list, how many patients it covered. It has
   * no room for a value or a name on purpose: the trail says who looked at whom,
   * not what they saw.
   */
  private audit(
    professionalId: string,
    action: 'READ' | 'READ_LIST' | 'READ_COHORT',
    patientId: string | null,
    route: string,
    patientCount: number | undefined,
    context: AuditContext,
  ): Promise<void> {
    return this.recordAudit({
      userId: professionalId,
      entity: 'PatientData',
      action,
      entityId: patientId,
      metadata: patientCount === undefined ? { route } : { route, patientCount },
      ...context,
    });
  }
}

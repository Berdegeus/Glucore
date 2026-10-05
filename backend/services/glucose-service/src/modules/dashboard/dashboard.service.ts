import { BadRequestError } from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { INVALID_TIMEZONE, type DashboardQuery } from './dashboard.schema';
import type { DashboardSummaryDto } from './dashboard.mapper';
import type { DateRange, IDashboardRepository } from './dashboard.repository';
import type { TimeZoneChecker } from './dashboard.timezones';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class DashboardService {
  constructor(
    private readonly dashboard: IDashboardRepository,
    private readonly patients: IPatientRepository,
    private readonly timeZones: TimeZoneChecker,
  ) {}

  async getSummaryForUser(userId: string, query: DashboardQuery): Promise<DashboardSummaryDto> {
    // First, before any patient row is created: a bad `tz` must cost nothing.
    if (!(await this.timeZones.isValid(query.tz))) {
      throw new BadRequestError(`tz "${query.tz}" is not a known time zone`, INVALID_TIMEZONE);
    }

    const patientId = await this.patients.ensure(userId);
    const { low, high } = await this.resolveThresholds(patientId);

    // `to` from the query is an inclusive calendar day; every query below needs
    // an exclusive upper bound, so the boundary is pushed one day forward here,
    // once, instead of in each repository method.
    const range: DateRange = { from: query.from, toExclusive: new Date(query.to.getTime() + MS_PER_DAY) };

    const [totals, periodMetrics, byDay, insulinByType, alertsByType, excursions] = await Promise.all([
      this.dashboard.getTotals(patientId, range),
      this.dashboard.getPeriodMetrics(patientId, range, low, high),
      this.dashboard.getDailyBuckets(patientId, range, low, high, query.tz),
      this.dashboard.getInsulinByType(patientId, range),
      this.dashboard.getAlertsByType(patientId, range),
      this.dashboard.getExcursions(patientId, range, low, high),
    ]);

    return {
      from: query.from.toISOString().slice(0, 10),
      to: query.to.toISOString().slice(0, 10),
      totals,
      timeInRangePercent: periodMetrics.timeInRangePercent,
      gmiPercent: periodMetrics.gmiPercent,
      coefficientOfVariationPercent: periodMetrics.cvPercent,
      byDay,
      insulinByType,
      alertsByType,
      excursions,
    };
  }

  /**
   * `AlertThresholdConfig` is an optional relation — a patient can reach this
   * endpoint before ever configuring one. Falling back to `Patient`'s own
   * target range keeps the dashboard computable either way; both default to
   * 80/180, so the common case never notices the fallback exists.
   */
  private async resolveThresholds(patientId: string): Promise<{ low: number; high: number }> {
    const config = await this.dashboard.getThresholdConfig(patientId);
    if (config) return { low: config.lowGlucoseMgDl, high: config.highGlucoseMgDl };

    const patient = await this.patients.findByUserId(patientId);
    return { low: patient?.targetRangeMin ?? 80, high: patient?.targetRangeMax ?? 180 };
  }
}

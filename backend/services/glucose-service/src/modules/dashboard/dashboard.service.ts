import { BadRequestError } from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { INVALID_TIMEZONE, type DashboardQuery } from './dashboard.schema';
import type { DashboardSummaryDto } from './dashboard.mapper';
import type { IDashboardRepository } from './dashboard.repository';
import { sensorUsePercent } from './dashboard.metrics';
import type { TimeZoneChecker } from './dashboard.timezones';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Calendar days in the period, both ends included: `from == to` is one day. */
function elapsedDays({ from, to }: DashboardQuery): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
}

export class DashboardService {
  constructor(
    private readonly dashboard: IDashboardRepository,
    private readonly patients: IPatientRepository,
    private readonly timeZones: TimeZoneChecker,
  ) {}

  async getSummaryForUser(userId: string, query: DashboardQuery): Promise<DashboardSummaryDto> {
    // First, before any patient row is created: a bad `tz` must cost nothing.
    await this.assertKnownTimeZone(query.tz);

    return this.getSummary(await this.patients.ensure(userId), query);
  }

  /**
   * The summary for a patient already identified by id — what a caller that is
   * not the patient (the professional module) reuses. It checks `tz` itself:
   * the zone is just as untrusted there.
   */
  async getSummary(patientId: string, query: DashboardQuery): Promise<DashboardSummaryDto> {
    await this.assertKnownTimeZone(query.tz);

    const { low, high } = await this.resolveThresholds(patientId);

    // `from`/`to` are calendar days as lived in `tz`; the repository turns them
    // into the UTC window `[from, toExclusive)` (a daylight-saving day is not 24 h).
    const range = await this.dashboard.resolveBounds(query.from, query.to, query.tz);

    const [
      totals,
      periodMetrics,
      zoneDistribution,
      lastReadingAt,
      byDay,
      agp,
      heatmap,
      insulinByType,
      alertsByType,
      excursions,
    ] = await Promise.all([
      this.dashboard.getTotals(patientId, range),
      this.dashboard.getPeriodMetrics(patientId, range, low, high),
      this.dashboard.getZoneDistribution(patientId, range, low, high),
      this.dashboard.getLastReadingAt(patientId),
      this.dashboard.getDailyBuckets(patientId, range, low, high, query.tz),
      this.dashboard.getAgp(patientId, range, query.tz),
      this.dashboard.getHeatmap(patientId, range, query.tz),
      this.dashboard.getInsulinByType(patientId, range),
      this.dashboard.getAlertsByType(patientId, range),
      this.dashboard.getExcursions(patientId, range, low, high),
    ]);

    return {
      from: query.from.toISOString().slice(0, 10),
      to: query.to.toISOString().slice(0, 10),
      tz: query.tz,
      lastReadingAt,
      totals,
      timeInRangePercent: periodMetrics.timeInRangePercent,
      gmiPercent: periodMetrics.gmiPercent,
      coefficientOfVariationPercent: periodMetrics.cvPercent,
      sensorUsePercent: sensorUsePercent(periodMetrics.readingsCount, elapsedDays(query)),
      zoneDistribution,
      byDay,
      agp,
      heatmap,
      insulinByType,
      alertsByType,
      excursions,
    };
  }

  private async assertKnownTimeZone(tz: string): Promise<void> {
    if (!(await this.timeZones.isValid(tz))) {
      throw new BadRequestError(`tz "${tz}" is not a known time zone`, INVALID_TIMEZONE);
    }
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

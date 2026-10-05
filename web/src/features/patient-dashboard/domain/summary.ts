// The patient's glucose summary and the port that fetches it (ARQ-05, PAC-01).
// The shape follows `GET /dashboard/summary`; days are cut in the zone `tz`.

import type { DateRange } from './period';
import type { GlucoseZone } from './zones';

/** One local day of the period (`day` is `YYYY-MM-DD`); glucose fields are `null` on a day with no readings. */
export interface DailyBucket {
  day: string;
  avgGlucose: number | null;
  minGlucose: number | null;
  maxGlucose: number | null;
  timeInRangePercent: number | null;
  /** The 7-day moving average of the daily mean. */
  movingAvg7d: number | null;
  readingsCount: number;
  /** Carbohydrate logged that day, in grams; 0 when none. */
  carbsGrams: number;
  /** Insulin logged that day, in units; 0 when none. */
  insulinUnits: number;
}

/** Percentiles of the readings taken at one local hour of the day: one point of the AGP curve. */
export interface AgpPoint {
  hour: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  count: number;
}

/** Mean glucose of one weekday and hour; `dayOfWeek` is 0 for Sunday to 6 for Saturday. */
export interface HeatCell {
  dayOfWeek: number;
  hour: number;
  avgGlucose: number;
  count: number;
}

/** A run of readings below or above the target, with its length and extremes. */
export interface Excursion {
  kind: 'HYPO' | 'HYPER';
  startedAt: string;
  endedAt: string;
  durationMin: number;
  minGlucose: number;
  maxGlucose: number;
}

export interface InsulinByType {
  insulinType: string;
  totalUnits: number;
  count: number;
  avgUnits: number;
}

export interface AlertsByType {
  alertType: string;
  count: number;
}

export interface SummaryTotals {
  readingsCount: number;
  carbEntries: number;
  insulinEntries: number;
  alertsCount: number;
}

export interface GlucoseSummary {
  from: string;
  to: string;
  /** The zone the days and hours below were cut in. */
  tz: string;
  /** The most recent reading in any period, `null` when there is none at all (PAC-12, PAC-13). */
  lastReadingAt: string | null;
  totals: SummaryTotals;
  timeInRangePercent: number | null;
  gmiPercent: number | null;
  coefficientOfVariationPercent: number | null;
  sensorUsePercent: number;
  /** Share of readings in each zone, in percent. */
  zoneDistribution: Record<GlucoseZone, number>;
  byDay: DailyBucket[];
  agp: AgpPoint[];
  heatmap: HeatCell[];
  insulinByType: InsulinByType[];
  alertsByType: AlertsByType[];
  excursions: Excursion[];
}

/** What to load: the period, the zone to cut days in, and whose summary (the signed-in patient's when omitted). */
export interface SummaryQuery {
  range: DateRange;
  timeZone: string;
  /** Set by a professional to read a linked patient's summary (PRO-*). */
  patientId?: string;
}

/** Fetches a glucose summary. A refused period fails with `validation`. */
export interface SummaryRepository {
  load(query: SummaryQuery): Promise<GlucoseSummary>;
}

// The risk rule of a patient in the portfolio (PRO-04). A pure function of the
// period metrics the list already carries, so it is tested without DOM or network.

export type RiskLevel = 'HIGH' | 'ATTENTION' | 'OK' | 'INSUFFICIENT';

/** Share of readings in each zone, in percent: the names of the API's `zoneDistribution`. */
export interface ZoneShares {
  veryLow: number;
  low: number;
  target: number;
  high: number;
  veryHigh: number;
}

/** What the rule reads: the metrics of one patient over the chosen period. */
export interface RiskInputs {
  timeInRangePercent: number | null;
  cvPercent: number | null;
  sensorUsePercent: number;
  zoneDistribution: ZoneShares;
}

/** Below this sensor use the metrics say too little to judge (Assumptions). */
export const MIN_SENSOR_USE_PERCENT = 70;
/** HIGH below this time in range, in percent. */
export const HIGH_TIR_BELOW = 50;
/** HIGH above this share of readings below 54 mg/dL, in percent. */
export const HIGH_VERY_LOW_ABOVE = 1;
/** ATTENTION below this time in range, in percent. */
export const ATTENTION_TIR_BELOW = 70;
/** ATTENTION above this share of readings below 70 mg/dL, in percent. */
export const ATTENTION_BELOW_RANGE_ABOVE = 4;
/** ATTENTION above this coefficient of variation, in percent. */
export const ATTENTION_CV_ABOVE = 36;

/**
 * `INSUFFICIENT` when the sensor was worn less than 70 % of the period or the
 * time in range or the CV is unknown. Else `HIGH` for a TIR under 50 % or more
 * than 1 % of the time below 54 mg/dL; else `ATTENTION` for a TIR under 70 %,
 * more than 4 % of the time below 70 mg/dL or a CV over 36 %; else `OK`.
 * Each limit is exclusive on the bad side: 50 %, 70 %, 1 %, 4 % and 36 % exactly are not flagged.
 */
export function classifyRisk(metrics: RiskInputs): RiskLevel {
  const { timeInRangePercent: tir, cvPercent: cv, sensorUsePercent, zoneDistribution: zones } = metrics;
  if (sensorUsePercent < MIN_SENSOR_USE_PERCENT || tir === null || cv === null) return 'INSUFFICIENT';

  if (tir < HIGH_TIR_BELOW || zones.veryLow > HIGH_VERY_LOW_ABOVE) return 'HIGH';

  // SPEC_DEVIATION: the time below 70 mg/dL is taken as `veryLow + low`.
  // Reason: the summary reports zones relative to the patient's own low threshold, not a fixed 70 mg/dL, so
  // the exact share below 70 is not in the data; the two lowest zones are the closest figure the API gives.
  const belowRange = zones.veryLow + zones.low;
  if (tir < ATTENTION_TIR_BELOW || belowRange > ATTENTION_BELOW_RANGE_ABOVE || cv > ATTENTION_CV_ABOVE) return 'ATTENTION';

  return 'OK';
}

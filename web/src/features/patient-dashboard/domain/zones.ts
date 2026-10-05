/** The five CGM zones of the international consensus (PAC-10); the same names as `zoneDistribution`. */
export const GLUCOSE_ZONES = ['veryLow', 'low', 'target', 'high', 'veryHigh'] as const;

export type GlucoseZone = (typeof GLUCOSE_ZONES)[number];

/**
 * The fixed limits of the consensus, in mg/dL. The patient's own `low` and
 * `high` thresholds move the edges of the target zone; these two do not.
 */
export const ZONE_BOUNDS = {
  /** Below this (or below the patient's low, if that is lower) the reading is "very low". */
  veryLowBelow: 54,
  /** Above this the reading is "very high". */
  veryHighAbove: 250,
} as const;

/**
 * Classifies a reading: `< min(54, low)` very low, up to `< low` low, `low` to
 * `high` inclusive on target, above `high` up to 250 high, above 250 very high.
 */
export function zoneOf(value: number, low: number, high: number): GlucoseZone {
  if (value < Math.min(ZONE_BOUNDS.veryLowBelow, low)) return 'veryLow';
  if (value < low) return 'low';
  if (value <= high) return 'target';
  return value > ZONE_BOUNDS.veryHighAbove ? 'veryHigh' : 'high';
}

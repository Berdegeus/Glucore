/** A 5-minute CGM sensor yields 24 × 60 / 5 readings a day when it never drops out. */
export const READINGS_PER_DAY = 288;

/**
 * How much of the period the sensor actually reported, in percent:
 * `readings ÷ (days × 288) × 100`, capped at 100 and rounded to two decimals
 * like every other percentage in the summary.
 *
 * Capped because a patient can wear two sensors, or a sensor can report more
 * often than every 5 minutes, and "112 % of the period" is not meaningful.
 * An empty period (`spanDays <= 0`) has nothing to be measured against, so it
 * is 0 rather than a division by zero.
 */
export function sensorUsePercent(readingsCount: number, spanDays: number): number {
  if (readingsCount <= 0 || spanDays <= 0) return 0;
  const percent = (readingsCount / (spanDays * READINGS_PER_DAY)) * 100;
  return Math.round(Math.min(100, percent) * 100) / 100;
}

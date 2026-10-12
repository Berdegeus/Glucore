/** A day has 24 × 60 / 5 five-minute slots; a sensor that never drops out covers all of them. */
export const SLOTS_PER_DAY = 288;

/**
 * How much of the period the sensor actually reported, in percent:
 * `coveredSlots ÷ (days × 288) × 100`, capped at 100 and rounded to two
 * decimals like every other percentage in the summary.
 *
 * It counts 5-minute slots with a reading, not readings, so it means the same
 * for a sensor that reports every minute, every five or every fifteen, and for
 * the thinned series the app uploads. Capped because a patient can wear two
 * sensors, and "112 % of the period" is not meaningful. An empty period
 * (`spanDays <= 0`) has nothing to be measured against, so it is 0 rather than
 * a division by zero.
 */
export function sensorUsePercent(coveredSlots: number, spanDays: number): number {
  if (coveredSlots <= 0 || spanDays <= 0) return 0;
  const percent = (coveredSlots / (spanDays * SLOTS_PER_DAY)) * 100;
  return Math.round(Math.min(100, percent) * 100) / 100;
}

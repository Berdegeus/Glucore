/** The part of a daily bucket these helpers read; `DailyBucket` satisfies it. */
export interface DayReadings {
  readonly avgGlucose: number | null;
  readonly readingsCount: number;
}

/** The GMI needs this many days that have readings to mean something (PAC-05). */
export const MIN_DAYS_FOR_GMI = 14;

/**
 * The mean glucose of a period: each day's average weighted by its reading
 * count, so a day with 288 readings counts for more than one with 10. Days
 * without a glucose average are ignored; `null` when no day has one (PAC-05).
 */
export function weightedMean(byDay: readonly DayReadings[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const day of byDay) {
    if (day.avgGlucose === null) continue;
    sum += day.avgGlucose * day.readingsCount;
    weight += day.readingsCount;
  }
  return weight === 0 ? null : sum / weight;
}

/** True when at least 14 days of the period have readings (PAC-05). */
export function hasEnoughDaysForGmi(byDay: readonly DayReadings[]): boolean {
  return byDay.filter((day) => day.readingsCount > 0).length >= MIN_DAYS_FOR_GMI;
}

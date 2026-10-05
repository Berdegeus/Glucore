import { describe, expect, it } from 'vitest';
import { hasEnoughDaysForGmi, weightedMean, type DayReadings } from './metrics';

const day = (avgGlucose: number | null, readingsCount: number): DayReadings => ({ avgGlucose, readingsCount });

/** `withReadings` days of 100 mg/dL followed by `empty` days with none. */
const period = (withReadings: number, empty = 0): DayReadings[] => [
  ...Array.from({ length: withReadings }, () => day(100, 288)),
  ...Array.from({ length: empty }, () => day(null, 0)),
];

describe('weightedMean (PAC-05)', () => {
  it.each<[string, DayReadings[], number | null]>([
    ['weights each day by its readings', [day(100, 300), day(200, 100)], 125],
    ['is the plain mean when the counts match', [day(100, 288), day(200, 288)], 150],
    ['ignores days without a glucose average', [day(null, 0), day(120, 10), day(null, 0)], 120],
    ['ignores a null average even when it carries a count', [day(null, 50), day(120, 10)], 120],
    ['is null when no day has a glucose average', [day(null, 0), day(null, 0)], null],
    ['is null for an empty period', [], null],
    ['is null when every average comes with no readings', [day(130, 0)], null],
  ])('%s', (_label, byDay, expected) => {
    expect(weightedMean(byDay)).toBe(expected);
  });
});

describe('hasEnoughDaysForGmi (PAC-05)', () => {
  it.each([
    ['13 days with readings are not enough', period(13), false],
    ['14 days with readings are enough', period(14), true],
    ['days without readings do not count: 13 + 5 empty', period(13, 5), false],
    ['days without readings do not stop 14 from counting: 14 + 5 empty', period(14, 5), true],
    ['an empty period is not enough', [], false],
  ])('%s', (_label, byDay, expected) => {
    expect(hasEnoughDaysForGmi(byDay)).toBe(expected);
  });
});

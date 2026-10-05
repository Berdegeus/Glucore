import { describe, expect, it } from 'vitest';
import { GLUCOSE_ZONES, ZONE_BOUNDS, zoneOf, type GlucoseZone } from './zones';

const LOW = 70;
const HIGH = 180;

describe('zoneOf (PAC-10, ARQ-04)', () => {
  // Each limit is probed just below it and exactly on it.
  it.each<[string, number, number, GlucoseZone]>([
    ['53 is very low', 53, LOW, 'veryLow'],
    ['54 is the first low value', 54, LOW, 'low'],
    ['low - 1 is low', LOW - 1, LOW, 'low'],
    ['low is the first on-target value', LOW, LOW, 'target'],
    ['high is the last on-target value', HIGH, LOW, 'target'],
    ['high + 1 is high', HIGH + 1, LOW, 'high'],
    ['250 is the last high value', 250, LOW, 'high'],
    ['251 is very high', 251, LOW, 'veryHigh'],
    ['with a low of 50, 49 is very low', 49, 50, 'veryLow'],
    ['with a low of 50, 50 is on target', 50, 50, 'target'],
    ['with a low of 50, 53 is on target, not very low', 53, 50, 'target'],
  ])('%s', (_label, value, low, expected) => {
    expect(zoneOf(value, low, HIGH)).toBe(expected);
  });

  it('exposes the consensus limits and the five zone names', () => {
    expect(ZONE_BOUNDS).toEqual({ veryLowBelow: 54, veryHighAbove: 250 });
    expect(GLUCOSE_ZONES).toEqual(['veryLow', 'low', 'target', 'high', 'veryHigh']);
  });
});

import { describe, expect, it } from 'vitest';

import { sensorUsePercent } from '../../src/modules/dashboard/dashboard.metrics';

describe('sensorUsePercent', () => {
  it('is 0 with no readings', () => {
    expect(sensorUsePercent(0, 14)).toBe(0);
  });

  it.each([
    [1, 288],
    [14, 14 * 288],
    [90, 90 * 288],
  ])('is 100 for a full period of %i days (%i readings)', (days, readings) => {
    expect(sensorUsePercent(readings, days)).toBe(100);
  });

  it('caps at 100 when there are more readings than the sensor can produce', () => {
    expect(sensorUsePercent(289, 1)).toBe(100);
    expect(sensorUsePercent(5000, 2)).toBe(100);
  });

  it('measures a one-day period against 288 readings', () => {
    expect(sensorUsePercent(144, 1)).toBe(50);
    expect(sensorUsePercent(287, 1)).toBe(99.65);
  });

  it('rounds to two decimals', () => {
    expect(sensorUsePercent(100, 1)).toBe(34.72);
  });

  it('is 0 for an empty period instead of dividing by zero', () => {
    expect(sensorUsePercent(10, 0)).toBe(0);
  });
});

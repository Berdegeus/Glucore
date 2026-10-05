import { describe, expect, it } from 'vitest';
import { classifyRisk, type RiskInputs, type RiskLevel, type ZoneShares } from './risk';

const ZONES: ZoneShares = { veryLow: 0, low: 0, target: 80, high: 20, veryHigh: 0 };

/** A patient who is fine on every measure; each test breaks one. */
function metrics(overrides: Partial<Omit<RiskInputs, 'zoneDistribution'>> & { zones?: Partial<ZoneShares> } = {}): RiskInputs {
  const { zones, ...rest } = overrides;
  return {
    timeInRangePercent: 80,
    cvPercent: 30,
    sensorUsePercent: 95,
    zoneDistribution: { ...ZONES, ...zones },
    ...rest,
  };
}

type Case = [string, RiskInputs, RiskLevel];

describe('classifyRisk baseline (PRO-04)', () => {
  it('is OK for a patient inside every limit', () => {
    expect(classifyRisk(metrics())).toBe('OK');
  });
});

describe('classifyRisk boundaries (PRO-04)', () => {
  it.each<Case>([
    ['TIR 49.99 is HIGH', metrics({ timeInRangePercent: 49.99 }), 'HIGH'],
    ['TIR 50 is not HIGH, but below 70 it is ATTENTION', metrics({ timeInRangePercent: 50 }), 'ATTENTION'],
    ['TIR 69.99 is ATTENTION', metrics({ timeInRangePercent: 69.99 }), 'ATTENTION'],
    ['TIR 70 is OK', metrics({ timeInRangePercent: 70 }), 'OK'],
    ['time below 54 at 1.00 % is not HIGH', metrics({ zones: { veryLow: 1 } }), 'OK'],
    ['time below 54 at 1.01 % is HIGH', metrics({ zones: { veryLow: 1.01 } }), 'HIGH'],
    ['time below 70 at 4.00 % is not flagged', metrics({ zones: { low: 4 } }), 'OK'],
    ['time below 70 at 4.01 % is ATTENTION', metrics({ zones: { low: 4.01 } }), 'ATTENTION'],
    ['CV 36.00 is not flagged', metrics({ cvPercent: 36 }), 'OK'],
    ['CV 36.01 is ATTENTION', metrics({ cvPercent: 36.01 }), 'ATTENTION'],
    ['sensor use 69.99 is INSUFFICIENT', metrics({ sensorUsePercent: 69.99 }), 'INSUFFICIENT'],
    ['sensor use 70 is judged, here OK', metrics({ sensorUsePercent: 70 }), 'OK'],
  ])('%s', (_label, input, expected) => {
    expect(classifyRisk(input)).toBe(expected);
  });
});

describe('classifyRisk precedence and unknowns (PRO-04)', () => {
  it.each<Case>([
    ['insufficient data beats a terrible TIR', metrics({ sensorUsePercent: 40, timeInRangePercent: 10 }), 'INSUFFICIENT'],
    ['an unknown TIR is INSUFFICIENT', metrics({ timeInRangePercent: null }), 'INSUFFICIENT'],
    ['an unknown CV is INSUFFICIENT', metrics({ cvPercent: null }), 'INSUFFICIENT'],
    ['HIGH beats ATTENTION when both apply', metrics({ timeInRangePercent: 40, cvPercent: 50 }), 'HIGH'],
    ['very low time makes it HIGH even with a good TIR', metrics({ timeInRangePercent: 90, zones: { veryLow: 2 } }), 'HIGH'],
    ['very low and low add up for the time below 70', metrics({ zones: { veryLow: 1, low: 3.01 } }), 'ATTENTION'],
    ['a well controlled patient with no very low time is OK', metrics({ timeInRangePercent: 95, cvPercent: 20, zones: { target: 95, high: 5 } }), 'OK'],
  ])('%s', (_label, input, expected) => {
    expect(classifyRisk(input)).toBe(expected);
  });
});

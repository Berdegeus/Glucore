import { describe, expect, it } from 'vitest';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { chartHeightFor, shortLabel, uniqueLabels } from './tirByPatientModel';

const named = (name: string) => ({ ...cohortSummaryOf().perPatient[0]!, displayName: name });

describe('chartHeightFor (PRO-10)', () => {
  it.each([
    { patients: 0, height: 160 },
    { patients: 2, height: 160 },
    { patients: 3, height: 192 },
    { patients: 50, height: 1696 },
  ])('gives a chart of $height px for $patients patients', ({ patients, height }) => {
    expect(chartHeightFor(patients)).toBe(height);
  });
});

describe('shortLabel (PRO-10)', () => {
  it.each([
    { name: 'Maria Julia', short: 'Maria Julia' },
    { name: 'Maria Julian', short: 'Maria Juli…' },
    { name: 'PB2', short: 'PB2' },
  ])('shortens "$name" to "$short"', ({ name, short }) => {
    expect(shortLabel(name)).toBe(short);
  });
});

describe('uniqueLabels (PRO-10)', () => {
  it('tells repeated names apart, in order of appearance, and leaves the others alone', () => {
    const labels = uniqueLabels(['Ana', 'Bia', 'Ana', 'Ana'].map(named));

    expect(labels).toEqual(['Ana', 'Bia', 'Ana (2)', 'Ana (3)']);
  });
});

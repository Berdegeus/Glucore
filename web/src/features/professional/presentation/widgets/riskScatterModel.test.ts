import { describe, expect, it } from 'vitest';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { cvAxisFor, omittedCount, scatterPointsOf, TIR_AXIS } from './riskScatterModel';

const at = (y: number) => ({ label: 'p', x: 50, y });

describe('cvAxisFor (PRO-10)', () => {
  it.each([
    { tallest: undefined, top: 60 },
    { tallest: 36, top: 60 },
    { tallest: 60, top: 60 },
    { tallest: 60.1, top: 70 },
    { tallest: 72, top: 80 },
  ])('tops the CV axis at $top when the most variable patient is at $tallest', ({ tallest, top }) => {
    const axis = cvAxisFor(tallest === undefined ? [] : [at(10), at(tallest)]);

    expect(axis.domain).toEqual([0, top]);
    expect(axis.threshold).toBe(36);
  });
});

describe('TIR axis (PRO-10)', () => {
  it('runs 0 to 100 and splits at 70', () => {
    expect(TIR_AXIS.domain).toEqual([0, 100]);
    expect(TIR_AXIS.threshold).toBe(70);
  });
});

describe('scatterPointsOf and omittedCount (PRO-10)', () => {
  const [ana, other] = cohortSummaryOf().perPatient;

  it('keeps a patient with TIR 0 and CV 0, which are values and not gaps', () => {
    const cohort = cohortSummaryOf({ perPatient: [{ ...ana!, timeInRangePercent: 0, cvPercent: 0 }] });

    expect(scatterPointsOf(cohort)).toEqual([{ label: 'Ana Souza', x: 0, y: 0 }]);
    expect(omittedCount(cohort)).toBe(0);
  });

  it('leaves out a patient missing either figure and counts it', () => {
    const cohort = cohortSummaryOf({ perPatient: [ana!, other!, { ...ana!, timeInRangePercent: 50, cvPercent: null }] });

    expect(scatterPointsOf(cohort).map((point) => point.label)).toEqual(['Ana Souza']);
    expect(omittedCount(cohort)).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { dayBucket } from '../../../../test/summaryFakes';
import { DEFAULT_TARGET_RANGE, trendAlternative, trendRows } from './trendModel';

const NBSP = '\u00a0';
const GAP_DAY = dayBucket({
  day: '2026-07-02',
  avgGlucose: null,
  minGlucose: null,
  maxGlucose: null,
  movingAvg7d: null,
  readingsCount: 0,
});

describe('trend model (PAC-06)', () => {
  it('uses the backend default target range until the summary carries the patient thresholds', () => {
    expect(DEFAULT_TARGET_RANGE).toEqual({ low: 80, high: 180 });
  });

  it('maps each day to the mean, the min-max pair and the 7-day average', () => {
    const rows = trendRows([dayBucket({ day: '2026-07-01', avgGlucose: 130, minGlucose: 70, maxGlucose: 210, movingAvg7d: 128 })]);

    expect(rows).toEqual([{ day: '01/07', avg: 130, min: 70, max: 210, movingAvg: 128 }]);
  });

  it('leaves a gap, not a zero, on a day with no readings', () => {
    expect(trendRows([GAP_DAY])).toEqual([{ day: '02/07', avg: null, min: null, max: null, movingAvg: null }]);
  });

  it('writes a table row per day in mg/dL, with a dash where a value is missing', () => {
    const { rows } = trendAlternative([dayBucket({ day: '2026-07-01', avgGlucose: 130.4, minGlucose: 70, maxGlucose: 210, movingAvg7d: 128 }), GAP_DAY]);

    expect(rows).toEqual([
      ['01/07/2026', `130${NBSP}mg/dL`, `70${NBSP}mg/dL`, `210${NBSP}mg/dL`, `128${NBSP}mg/dL`],
      ['02/07/2026', '—', '—', '—', '—'],
    ]);
  });

  it.each([
    {
      days: [dayBucket({ day: '2026-07-01', avgGlucose: 100 }), dayBucket({ day: '2026-07-02', avgGlucose: 160 })],
      sentence: 'Tendência da glicose por dia, de 01/07 a 02/07: média diária de 100 a 160 mg/dL, com faixa-alvo de 80 a 180 mg/dL.',
    },
    {
      days: [dayBucket({ day: '2026-07-01', avgGlucose: 100 })],
      sentence: 'Tendência da glicose por dia, de 01/07 a 01/07: média diária de 100 mg/dL, com faixa-alvo de 80 a 180 mg/dL.',
    },
    {
      days: [GAP_DAY],
      sentence: 'Tendência da glicose por dia, de 02/07 a 02/07: sem média diária, com faixa-alvo de 80 a 180 mg/dL.',
    },
    { days: [], sentence: 'Tendência da glicose por dia: sem média diária, com faixa-alvo de 80 a 180 mg/dL.' },
  ])('summarizes the period in one sentence: $sentence', ({ days, sentence }) => {
    expect(trendAlternative(days).summary).toBe(sentence);
  });
});

import { describe, expect, it } from 'vitest';
import { dayBucket } from '../../../../test/summaryFakes';
import { dailyTirAlternative, dailyTirRows } from './dailyTirModel';

const NBSP = '\u00a0';
const GAP_DAY = dayBucket({ day: '2026-07-02', timeInRangePercent: null, readingsCount: 0 });
const tir = (day: string, percent: number) => dayBucket({ day: `2026-07-${day}`, timeInRangePercent: percent });

describe('daily time in range model (PAC-07)', () => {
  it('maps each day to its percentage of readings on target', () => {
    expect(dailyTirRows([tir('01', 62.5), tir('02', 100)])).toEqual([
      { day: '01/07', tir: 62.5 },
      { day: '02/07', tir: 100 },
    ]);
  });

  it('keeps a day with no readings as a gap, not as 0', () => {
    expect(dailyTirRows([GAP_DAY])).toEqual([{ day: '02/07', tir: null }]);
  });

  it('writes the percentage with one decimal and a dash for a day with no readings', () => {
    expect(dailyTirAlternative([tir('01', 62.54), GAP_DAY]).rows).toEqual([
      ['01/07/2026', `62,5${NBSP}%`],
      ['02/07/2026', '—'],
    ]);
  });

  it.each([
    {
      days: [tir('01', 40), GAP_DAY, tir('03', 85.25)],
      sentence: `Tempo no alvo por dia, de 01/07 a 03/07: 40,0${NBSP}% a 85,3${NBSP}%.`,
    },
    { days: [GAP_DAY], sentence: 'Tempo no alvo por dia, de 02/07 a 02/07: sem dias com leituras.' },
    { days: [], sentence: 'Tempo no alvo por dia: sem dias com leituras.' },
  ])('summarizes the period in one sentence: $sentence', ({ days, sentence }) => {
    expect(dailyTirAlternative(days).summary).toBe(sentence);
  });
});

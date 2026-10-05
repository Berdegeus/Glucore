import { describe, expect, it } from 'vitest';
import { agpAlternative, agpRows } from './agpModel';

const NBSP = ' ';
const point = (hour: number, p50: number, count = 4) => ({ hour, p5: p50 - 40, p25: p50 - 20, p50, p75: p50 + 20, p95: p50 + 40, count });

describe('AGP model (PAC-10)', () => {
  it('has a row for each of the 24 hours, in order', () => {
    const rows = agpRows([point(8, 100)]);

    expect(rows).toHaveLength(24);
    expect(rows.map((row) => row.hour).slice(0, 3)).toEqual(['0h', '1h', '2h']);
    expect(rows[23]?.hour).toBe('23h');
  });

  it('puts the percentiles of an hour on its row and leaves a gap on every other hour', () => {
    const rows = agpRows([point(8, 100), point(23, 150)]);

    expect(rows[8]).toEqual({ hour: '8h', p5: 60, p25: 80, p50: 100, p75: 120, p95: 140 });
    expect(rows[23]).toMatchObject({ p5: 110, p95: 190 });
    expect(rows[9]).toEqual({ hour: '9h', p5: null, p25: null, p50: null, p75: null, p95: null });
  });

  it('lists only the hours with readings, ordered by hour, with their count', () => {
    const { rows } = agpAlternative([point(9, 200, 7), point(8, 100)]);

    expect(rows).toEqual([
      ['8h', `60${NBSP}mg/dL`, `80${NBSP}mg/dL`, `100${NBSP}mg/dL`, `120${NBSP}mg/dL`, `140${NBSP}mg/dL`, '4'],
      ['9h', `160${NBSP}mg/dL`, `180${NBSP}mg/dL`, `200${NBSP}mg/dL`, `220${NBSP}mg/dL`, `240${NBSP}mg/dL`, '7'],
    ]);
  });

  it.each([
    { points: [point(9, 200), point(8, 100)], where: 'das 8h às 9h, mediana de 100 a 200 mg/dL' },
    { points: [point(8, 100)], where: 'das 8h às 8h, mediana de 100 mg/dL' },
    { points: [], where: 'sem horas com leituras' },
  ])('summarizes the profile in one sentence: $where', ({ points, where }) => {
    expect(agpAlternative(points).summary).toBe(
      `Perfil ambulatorial da glicose por hora: ${where}, com as faixas dos percentis 25 a 75 e 5 a 95.`,
    );
  });
});

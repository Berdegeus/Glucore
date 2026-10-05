import { describe, expect, it } from 'vitest';
import { heatmapAlternative, heatmapCells, WEEKDAY_LABELS } from './heatmapCells';

const NBSP = '\u00a0';
const cell = (dayOfWeek: number, hour: number, avgGlucose: number, count = 3) => ({ dayOfWeek, hour, avgGlucose, count });

describe('heat map cells (PAC-10)', () => {
  it('counts the weekdays from Sunday, in pt-BR', () => {
    expect(WEEKDAY_LABELS).toEqual(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']);
  });

  it('maps a weekday, an hour and a mean to a chart cell', () => {
    expect(heatmapCells([cell(0, 23, 110.5), cell(6, 0, 90)])).toEqual([
      { day: 0, hour: 23, value: 110.5 },
      { day: 6, hour: 0, value: 90 },
    ]);
  });

  it('names Sunday as day 0 and Saturday as day 6 in the table, ordered by day and hour', () => {
    const { rows } = heatmapAlternative([cell(6, 1, 120, 5), cell(0, 9, 100.4), cell(0, 2, 99)]);

    expect(rows).toEqual([
      ['domingo', '2h', `99${NBSP}mg/dL`, '3'],
      ['domingo', '9h', `100${NBSP}mg/dL`, '3'],
      ['sábado', '1h', `120${NBSP}mg/dL`, '5'],
    ]);
  });

  it('names every weekday', () => {
    const { rows } = heatmapAlternative(Array.from({ length: 7 }, (_, day) => cell(day, 0, 100)));

    expect(rows.map((row) => row[0])).toEqual(['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']);
  });

  it.each([
    { cells: [cell(1, 8, 100), cell(2, 9, 180)], text: 'glicose média de 100 a 180 mg/dL; combinações de dia e hora com leituras: 2' },
    { cells: [cell(1, 8, 100)], text: 'glicose média de 100 mg/dL; combinações de dia e hora com leituras: 1' },
    { cells: [], text: 'sem leituras por dia da semana e hora; combinações de dia e hora com leituras: 0' },
  ])('summarizes the map in one sentence: $text', ({ cells, text }) => {
    expect(heatmapAlternative(cells).summary).toBe(`Mapa de calor da glicose por dia da semana e hora: ${text}.`);
  });
});

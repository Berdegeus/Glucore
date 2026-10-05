import { describe, expect, it } from 'vitest';
import type { Excursion } from '../../domain/summary';
import { excursionCells, EXCURSIONS_COLUMNS } from './excursionsModel';

const NBSP = ' ';
const excursion = (overrides: Partial<Excursion> = {}): Excursion => ({
  kind: 'HYPO',
  startedAt: '2026-08-05T08:00:00.000Z',
  endedAt: '2026-08-05T08:25:00.000Z',
  durationMin: 30,
  minGlucose: 55,
  maxGlucose: 65,
  ...overrides,
});

describe('excursion cells (PAC-08)', () => {
  it('lists the type, start, duration, minimum and maximum', () => {
    expect(EXCURSIONS_COLUMNS).toEqual(['Tipo', 'Início', 'Duração', 'Mínimo', 'Máximo']);
    expect(excursionCells(excursion(), 'UTC')).toEqual(['Hipoglicemia', '05/08/2026 08:00', '30 min', `55${NBSP}mg/dL`, `65${NBSP}mg/dL`]);
  });

  it('names a high episode in words', () => {
    expect(excursionCells(excursion({ kind: 'HYPER' }), 'UTC')[0]).toBe('Hiperglicemia');
  });

  it('shows the start on the clock of the time zone it is given (RSP-09)', () => {
    expect(excursionCells(excursion(), 'America/Sao_Paulo')[1]).toBe('05/08/2026 05:00');
  });

  it('shows a duration beyond an hour in minutes', () => {
    expect(excursionCells(excursion({ durationMin: 135 }), 'UTC')[2]).toBe('135 min');
  });
});

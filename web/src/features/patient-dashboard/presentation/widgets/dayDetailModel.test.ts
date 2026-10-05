import { describe, expect, it } from 'vitest';
import { carb, insulin, reading } from '../../../../test/diaryFakes';
import type { DayDetail } from '../../application/loadDayDetail';
import { DAY_DETAIL_COLUMNS, dayDetailAlternative, dayDetailRows } from './dayDetailModel';

const NBSP = ' ';
const ZONE = 'America/Sao_Paulo';
/** A UTC instant `hours:minutes` after 2026-08-05 00:00 in Sao Paulo (03:00 UTC). */
const at = (hours: number, minutes = 0) => Date.UTC(2026, 7, 5, 3 + hours, minutes);

const detail = (overrides: Partial<DayDetail> = {}): DayDetail => ({
  day: '2026-08-05',
  timeZone: ZONE,
  readings: [reading(at(8), 90), reading(at(8, 5), 110), reading(at(12), 170)],
  carbs: [],
  insulin: [],
  ...overrides,
});

describe('dayDetailRows (PAC-11)', () => {
  it('makes one point per reading, labeled with the time on the local clock', () => {
    const rows = dayDetailRows(detail({ readings: [reading(Date.UTC(2026, 7, 6, 2, 30), 101)] }));

    expect(rows).toEqual([{ time: '23:30', glucose: 101, carbs: null, insulin: null }]);
  });

  it('puts a carbohydrate and an insulin marker at the height of the reading closest to each', () => {
    const rows = dayDetailRows(detail({ carbs: [carb(at(8, 4))], insulin: [insulin(at(11))] }));

    expect(rows.map((row) => [row.glucose, row.carbs, row.insulin])).toEqual([
      [90, null, null],
      [110, 110, null],
      [170, null, 170],
    ]);
  });

  it('puts an entry before the first reading on the first point, and one after the last on the last', () => {
    const rows = dayDetailRows(detail({ carbs: [carb(at(1))], insulin: [insulin(at(23))] }));

    expect(rows.map((row) => [row.carbs, row.insulin])).toEqual([
      [90, null],
      [null, null],
      [null, 170],
    ]);
  });

  it('has no point, and no marker to place, for a day without readings', () => {
    expect(dayDetailRows(detail({ readings: [], carbs: [carb(at(8))] }))).toEqual([]);
  });
});

describe('dayDetailAlternative (PAC-11, RSP-07)', () => {
  it('summarises the readings and the entries of the day in one sentence, in pt-BR', () => {
    const { summary } = dayDetailAlternative(detail({ carbs: [carb(at(8), 30), carb(at(9), 15)], insulin: [insulin(at(8), 4.5)] }));

    expect(summary).toBe(
      `Glicose em 05/08/2026: 3${NBSP}leituras, de 90${NBSP}mg/dL a 170${NBSP}mg/dL; 2${NBSP}registros de carboidrato (45${NBSP}g) e 1${NBSP}registro de insulina (4,5${NBSP}U).`,
    );
  });

  it('says there is no carbohydrate or insulin entry when the day has none', () => {
    const { summary } = dayDetailAlternative(detail());

    expect(summary).toContain('; sem registro de carboidrato ou insulina.');
  });

  it('gives the plain value, not a range, when every reading is alike, and the singular for one reading', () => {
    const { summary } = dayDetailAlternative(detail({ readings: [reading(at(8), 100)] }));

    expect(summary).toContain(`1${NBSP}leitura, de 100${NBSP}mg/dL;`);
  });

  it('lists every reading and entry as a table row, by time, with a dash where the column does not apply', () => {
    const { columns, rows, tableCaption } = dayDetailAlternative(
      detail({ readings: [reading(at(8), 90), reading(at(9), 110)], carbs: [carb(at(8, 30), 30)], insulin: [insulin(at(7, 55), 4)] }),
    );

    expect(columns).toEqual(DAY_DETAIL_COLUMNS);
    expect(tableCaption).toBe('Leituras, carboidrato e insulina de 05/08/2026');
    expect(rows).toEqual([
      ['07:55', '—', '—', `4,0${NBSP}U (RAPID)`],
      ['08:00', `90${NBSP}mg/dL`, '—', '—'],
      ['08:30', '—', `30${NBSP}g (Pão)`, '—'],
      ['09:00', `110${NBSP}mg/dL`, '—', '—'],
    ]);
  });

  it('leaves out the parentheses when a carbohydrate entry has no description', () => {
    const { rows } = dayDetailAlternative(detail({ readings: [], carbs: [{ ...carb(at(8), 20), description: '' }] }));

    expect(rows).toEqual([['08:00', '—', `20${NBSP}g`, '—']]);
  });

  it('has no range to give for a day without readings', () => {
    expect(dayDetailAlternative(detail({ readings: [] })).summary).toBe('Glicose em 05/08/2026: sem leituras; sem registro de carboidrato ou insulina.');
  });
});

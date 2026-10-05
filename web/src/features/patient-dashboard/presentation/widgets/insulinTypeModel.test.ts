import { describe, expect, it } from 'vitest';
import { insulinTypeAlternative, insulinTypeRows } from './insulinTypeModel';

const NBSP = '\u00a0';
const entry = (insulinType: string, totalUnits: number, count: number) => ({ insulinType, totalUnits, count, avgUnits: totalUnits / count });

describe('insulin by type model (PAC-09)', () => {
  it('maps each type to its total units', () => {
    expect(insulinTypeRows([entry('RAPID', 30, 3), entry('BASAL', 22.5, 1)])).toEqual([
      { type: 'RAPID', units: 30 },
      { type: 'BASAL', units: 22.5 },
    ]);
  });

  it('adds the count of records to each table row, with units in pt-BR', () => {
    expect(insulinTypeAlternative([entry('RAPID', 30, 3), entry('BASAL', 22.5, 1)]).rows).toEqual([
      ['RAPID', `30,0${NBSP}U`, '3'],
      ['BASAL', `22,5${NBSP}U`, '1'],
    ]);
  });

  it.each([
    {
      types: [entry('RAPID', 30, 3), entry('BASAL', 22.5, 1)],
      sentence: `Insulina total por tipo: RAPID 30,0${NBSP}U em 3${NBSP}registros; BASAL 22,5${NBSP}U em 1${NBSP}registro.`,
    },
    { types: [], sentence: 'Insulina total por tipo: nenhum registro.' },
  ])('summarizes the totals in one sentence: $sentence', ({ types, sentence }) => {
    expect(insulinTypeAlternative(types).summary).toBe(sentence);
  });
});

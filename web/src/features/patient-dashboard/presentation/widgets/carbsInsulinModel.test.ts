import { describe, expect, it } from 'vitest';
import { dayBucket } from '../../../../test/summaryFakes';
import { carbsInsulinAlternative, carbsInsulinRows, formatQuantity, hasNoDiary } from './carbsInsulinModel';

const NBSP = '\u00a0';
const day = (date: string, carbsGrams: number, insulinUnits: number) => dayBucket({ day: `2026-07-${date}`, carbsGrams, insulinUnits });
// A day with a diary entry and no reading at all.
const DIARY_ONLY = dayBucket({ day: '2026-07-03', avgGlucose: null, readingsCount: 0, carbsGrams: 40, insulinUnits: 0 });

describe('carbs and insulin model (PAC-10)', () => {
  it('maps each day to its grams of carbohydrate and units of insulin', () => {
    expect(carbsInsulinRows([day('01', 120, 8.5), DIARY_ONLY])).toEqual([
      { day: '01/07', carbs: 120, insulin: 8.5 },
      { day: '03/07', carbs: 40, insulin: 0 },
    ]);
  });

  it('writes grams and units with their unit in the table, one row per day', () => {
    expect(carbsInsulinAlternative([day('01', 120, 8.5), DIARY_ONLY]).rows).toEqual([
      ['01/07/2026', `120${NBSP}g`, `8,5${NBSP}U`],
      ['03/07/2026', `40${NBSP}g`, `0,0${NBSP}U`],
    ]);
  });

  it('says in the summary and in the table caption that the two values have different units', () => {
    const { summary, tableCaption } = carbsInsulinAlternative([day('01', 120, 8.5), DIARY_ONLY]);

    expect(summary).toBe(
      `Carboidratos e insulina por dia, de 01/07 a 03/07: carboidratos 40${NBSP}g a 120${NBSP}g, insulina 0,0${NBSP}U a 8,5${NBSP}U; valores em unidades diferentes; veja a tabela.`,
    );
    expect(tableCaption).toBe('Carboidratos em gramas e insulina em unidades, por dia');
  });

  it.each([
    { days: [], none: true },
    { days: [day('01', 0, 0)], none: true },
    { days: [day('01', 0, 0.5)], none: false },
    { days: [day('01', 1, 0)], none: false },
  ])('has no diary record: $none', ({ days, none }) => {
    expect(hasNoDiary(days)).toBe(none);
  });

  it.each([
    { value: 0, text: '0' },
    { value: 120, text: '120' },
    { value: 2.5, text: '2,5' },
    { value: 2.25, text: '2,3' },
  ])('shows $value as $text', ({ value, text }) => {
    expect(formatQuantity(value)).toBe(text);
  });
});

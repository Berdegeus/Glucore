import { describe, expect, it } from 'vitest';
import { countOf, daySpan, formatGrams, formatUnits, valueSpan } from './summaryText';

const whole = (value: number) => String(Math.round(value));

describe('summary text', () => {
  it.each([
    { days: [{ day: '2026-08-05' }, { day: '2026-08-06' }, { day: '2026-08-09' }], span: ', de 05/08 a 09/08' },
    { days: [{ day: '2026-08-05' }], span: ', de 05/08 a 05/08' },
    { days: [], span: '' },
  ])('names the days covered: "$span"', ({ days, span }) => {
    expect(daySpan(days)).toBe(span);
  });

  it.each([
    { values: [100, 160, 130], span: '100 a 160' },
    { values: [100.2, 99.9], span: '100' },
    { values: [], span: null },
  ])('reads the span of $values as $span', ({ values, span }) => {
    expect(valueSpan(values, whole)).toBe(span);
  });

  it.each([
    { count: 0, text: '0\u00a0registros' },
    { count: 1, text: '1\u00a0registro' },
    { count: 2, text: '2\u00a0registros' },
  ])('agrees the noun with a count of $count', ({ count, text }) => {
    expect(countOf(count, 'registro', 'registros')).toBe(text);
  });

  it('writes units with one decimal and grams as whole numbers, in pt-BR', () => {
    expect(formatUnits(30)).toBe('30,0\u00a0U');
    expect(formatUnits(2.25)).toBe('2,3\u00a0U');
    expect(formatGrams(105.4)).toBe('105\u00a0g');
  });
});

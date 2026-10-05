import { describe, expect, it } from 'vitest';
import { daySpan, valueSpan } from './summaryText';

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
});

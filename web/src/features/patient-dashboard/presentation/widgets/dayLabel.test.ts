import { describe, expect, it } from 'vitest';
import { fullDay, shortDay } from './dayLabel';

describe('day labels', () => {
  it.each([
    { day: '2026-08-05', full: '05/08/2026', short: '05/08' },
    { day: '2026-12-31', full: '31/12/2026', short: '31/12' },
  ])('writes $day as $full and $short, in pt-BR', ({ day, full, short }) => {
    expect(fullDay(day)).toBe(full);
    expect(shortDay(day)).toBe(short);
  });
});

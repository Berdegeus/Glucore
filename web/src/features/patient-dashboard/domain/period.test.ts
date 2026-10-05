import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import {
  DEFAULT_PRESET,
  MAX_PERIOD_DAYS,
  PERIOD_ERROR_MESSAGE,
  PERIOD_PRESETS,
  toRange,
  validateCustom,
  type PeriodPreset,
} from './period';

describe('toRange (PAC-02)', () => {
  it.each<[PeriodPreset, string, string, string]>([
    [7, '2026-03-15', '2026-03-09', 'a week'],
    [14, '2026-03-15', '2026-03-02', 'two weeks'],
    [30, '2026-03-15', '2026-02-14', 'a month, across a short February'],
    [90, '2026-03-15', '2025-12-16', 'three months, across the year end'],
    [7, '2026-01-03', '2025-12-28', 'a week that starts in the previous year'],
  ])('counts %s days back from %s to start on %s (%s), today included', (preset, today, from) => {
    expect(toRange(preset, today)).toEqual({ from, to: today });
  });

  it('offers the four presets of the filter and opens on 14 days', () => {
    expect(PERIOD_PRESETS).toEqual([7, 14, 30, 90]);
    expect(DEFAULT_PRESET).toBe(14);
  });

  it('keeps the widest preset inside the limit of a custom period', () => {
    const { from, to } = toRange(90, '2026-03-15');

    expect(validateCustom(from, to)).toMatchObject({ ok: true });
  });

  it('refuses a today that is not a real day', () => {
    expect(() => toRange(7, '2026-02-30')).toThrow(RangeError);
  });
});

describe('validateCustom (PAC-03, PAC-04)', () => {
  it('accepts a period of exactly 90 days, both ends counted, and returns it as given', () => {
    expect(MAX_PERIOD_DAYS).toBe(90);
    expect(validateCustom('2026-01-01', '2026-03-31')).toEqual({
      ok: true,
      range: { from: '2026-01-01', to: '2026-03-31' },
    });
  });

  it('accepts a single day', () => {
    expect(validateCustom('2026-03-15', '2026-03-15')).toMatchObject({ ok: true });
  });

  it.each([
    ['91 days', '2026-01-01', '2026-04-01'],
    ['a start after the end', '2026-03-02', '2026-03-01'],
    ['an empty start', '', '2026-03-01'],
    ['an empty end', '2026-03-01', ''],
    ['a day that does not exist', '2026-02-30', '2026-03-10'],
    ['a date that is not YYYY-MM-DD', '01/03/2026', '2026-03-10'],
  ])('refuses %s with "Escolha um período de até 90 dias"', (_label, from, to) => {
    const result = validateCustom(from, to);

    expect(result).toMatchObject({ ok: false, message: 'Escolha um período de até 90 dias' });
    expect(PERIOD_ERROR_MESSAGE).toBe('Escolha um período de até 90 dias');
  });

  it('carries a validation AppError with the INVALID_PERIOD code', () => {
    const result = validateCustom('2026-03-02', '2026-03-01');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(AppError);
    expect(result.error).toMatchObject({ kind: 'validation', code: 'INVALID_PERIOD' });
  });
});

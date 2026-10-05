import { formatNumber } from '../../../../shared/presentation/format';
import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import type { DailyBucket } from '../../domain/summary';
import type { ChartAlternative } from './chartWidget';
import { fullDay, shortDay } from './dayLabel';
import { daySpan, formatGrams, formatUnits, valueSpan } from './summaryText';

export const CARBS_INSULIN_COLUMNS = ['Dia', 'Carboidratos', 'Insulina'] as const;

export const CARBS_SERIES = { key: 'carbs', label: 'Carboidratos (g)' };
export const INSULIN_SERIES = { key: 'insulin', label: 'Insulina (U)' };

/** Two quantities in different units share one axis, so a reader is told so (PAC-10). */
export const UNITS_NOTE = 'valores em unidades diferentes; veja a tabela';

export const CARBS_INSULIN_TABLE_CAPTION = 'Carboidratos em gramas e insulina em unidades, por dia';

/** True when no day of the period has a carbohydrate or insulin record. */
export const hasNoDiary = (byDay: readonly DailyBucket[]): boolean => !byDay.some((day) => day.carbsGrams > 0 || day.insulinUnits > 0);

/** A tick or tooltip value: whole when it is whole, one decimal otherwise, so 2,5 U is not shown as 3. */
export const formatQuantity = (value: number): string => formatNumber(value, Number.isInteger(value) ? 0 : 1);

/** One group of bars per day, including a day with only diary entries and no readings. */
export function carbsInsulinRows(byDay: readonly DailyBucket[]): ChartRow[] {
  return byDay.map((day) => ({ day: shortDay(day.day), carbs: day.carbsGrams, insulin: day.insulinUnits }));
}

const spanOf = (values: readonly number[], format: (value: number) => string): string => valueSpan(values, format) ?? '';

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function carbsInsulinAlternative(byDay: readonly DailyBucket[]): ChartAlternative {
  const carbs = spanOf(byDay.map((day) => day.carbsGrams), formatGrams);
  const insulin = spanOf(byDay.map((day) => day.insulinUnits), formatUnits);
  return {
    summary: `Carboidratos e insulina por dia${daySpan(byDay)}: carboidratos ${carbs}, insulina ${insulin}; ${UNITS_NOTE}.`,
    columns: CARBS_INSULIN_COLUMNS,
    tableCaption: CARBS_INSULIN_TABLE_CAPTION,
    rows: byDay.map((day) => [fullDay(day.day), formatGrams(day.carbsGrams), formatUnits(day.insulinUnits)]),
  };
}

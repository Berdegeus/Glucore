import type { InsulinEvent } from '@prisma/client';

/** An insulin dose as the app reads it. */
export interface InsulinDto {
  id: string;
  units: number;
  type: string;
  timeMs: number;
  dayOfWeek: string;
}

/** `doseUnits` is a Decimal column; see the carbs mapper for why Number(). */
export function toInsulinDto(row: InsulinEvent): InsulinDto {
  return {
    id: row.id,
    units: Number(row.doseUnits),
    type: row.insulinType,
    timeMs: row.eventAt.getTime(),
    dayOfWeek: row.dayOfWeek,
  };
}

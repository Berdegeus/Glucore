import type { CarbEvent } from '@prisma/client';

/** A carbohydrate entry as the app reads it. */
export interface CarbDto {
  id: string;
  grams: number;
  description: string;
  timeMs: number;
}

/**
 * `carbsGrams` is a Decimal column, which Prisma hands back as a Decimal
 * object; JSON.stringify would render it as an object rather than a number.
 */
export function toCarbDto(row: CarbEvent): CarbDto {
  return {
    id: row.id,
    grams: Number(row.carbsGrams),
    description: row.description,
    timeMs: row.eventAt.getTime(),
  };
}

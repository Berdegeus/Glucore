import type { GlucoseReading } from '@prisma/client';

/** A glucose sample as the app reads it. */
export interface ReadingDto {
  value: number;
  timestampMs: number;
  trend: string;
  rate: number;
  alarmCode: number | null;
}

export function toReadingDto(row: GlucoseReading): ReadingDto {
  return {
    value: row.valueMgDl,
    timestampMs: row.recordedAt.getTime(),
    trend: row.trend,
    rate: row.trendRate,
    alarmCode: row.alarmCode,
  };
}

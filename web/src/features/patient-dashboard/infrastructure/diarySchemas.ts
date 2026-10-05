import * as z from 'zod';

// Every field the web reads is required (ARQ-07). The backend serializes its
// Decimal columns as numbers, so `grams` and `units` arrive as numbers.

export const ReadingDtoSchema = z.object({
  value: z.number(),
  timestampMs: z.number(),
  trend: z.string(),
  rate: z.number(),
  alarmCode: z.number().nullable(),
});

export const CarbDtoSchema = z.object({
  id: z.string().min(1),
  grams: z.number(),
  description: z.string(),
  timeMs: z.number(),
});

export const InsulinDtoSchema = z.object({
  id: z.string().min(1),
  units: z.number(),
  type: z.string(),
  timeMs: z.number(),
  dayOfWeek: z.string(),
});

export type ReadingDto = z.infer<typeof ReadingDtoSchema>;
export type CarbDto = z.infer<typeof CarbDtoSchema>;
export type InsulinDto = z.infer<typeof InsulinDtoSchema>;

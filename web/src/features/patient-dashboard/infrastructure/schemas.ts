import * as z from 'zod';

// Every field the web reads is required (ARQ-07): a field the API drops fails
// at the edge, not inside a widget. Unknown extra fields are stripped.

const nullableNumber = z.number().nullable();

const DailyBucketDtoSchema = z.object({
  day: z.string().min(1),
  avgGlucose: nullableNumber,
  minGlucose: nullableNumber,
  maxGlucose: nullableNumber,
  timeInRangePercent: nullableNumber,
  movingAvg7d: nullableNumber,
  readingsCount: z.number(),
  carbsGrams: z.number(),
  insulinUnits: z.number(),
});

const AgpPointDtoSchema = z.object({
  hour: z.number(),
  p5: z.number(),
  p25: z.number(),
  p50: z.number(),
  p75: z.number(),
  p95: z.number(),
  count: z.number(),
});

const HeatCellDtoSchema = z.object({
  dayOfWeek: z.number(),
  hour: z.number(),
  avgGlucose: z.number(),
  count: z.number(),
});

const ExcursionDtoSchema = z.object({
  kind: z.enum(['HYPO', 'HYPER']),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMin: z.number(),
  minGlucose: z.number(),
  maxGlucose: z.number(),
});

const InsulinByTypeDtoSchema = z.object({
  insulinType: z.string(),
  totalUnits: z.number(),
  count: z.number(),
  avgUnits: z.number(),
});

const AlertsByTypeDtoSchema = z.object({ alertType: z.string(), count: z.number() });

const TotalsDtoSchema = z.object({
  readingsCount: z.number(),
  carbEntries: z.number(),
  insulinEntries: z.number(),
  alertsCount: z.number(),
});

const ZoneDistributionDtoSchema = z.object({
  veryLow: z.number(),
  low: z.number(),
  target: z.number(),
  high: z.number(),
  veryHigh: z.number(),
});

/** `GET /dashboard/summary` and `GET /professional/patients/:id/summary` answer this shape. */
export const SummaryDtoSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  tz: z.string().min(1),
  lastReadingAt: z.string().min(1).nullable(),
  totals: TotalsDtoSchema,
  timeInRangePercent: nullableNumber,
  gmiPercent: nullableNumber,
  coefficientOfVariationPercent: nullableNumber,
  sensorUsePercent: z.number(),
  zoneDistribution: ZoneDistributionDtoSchema,
  byDay: z.array(DailyBucketDtoSchema),
  agp: z.array(AgpPointDtoSchema),
  heatmap: z.array(HeatCellDtoSchema),
  insulinByType: z.array(InsulinByTypeDtoSchema),
  alertsByType: z.array(AlertsByTypeDtoSchema),
  excursions: z.array(ExcursionDtoSchema),
});

export type SummaryDto = z.infer<typeof SummaryDtoSchema>;

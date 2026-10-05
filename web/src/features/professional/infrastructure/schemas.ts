import * as z from 'zod';

// Every field the web reads is required (ARQ-07). Unknown extra fields are
// stripped. `fullName` is nullable because the gateway leaves it out when the
// names lookup fails (PRO-15); `initials` is always there.

const nullableNumber = z.number().nullable();

const ZoneDistributionDtoSchema = z.object({
  veryLow: z.number(),
  low: z.number(),
  target: z.number(),
  high: z.number(),
  veryHigh: z.number(),
});

const PatientRowDtoSchema = z.object({
  patientId: z.string().min(1),
  fullName: z.string().nullable(),
  initials: z.string().min(1),
  lastReadingAt: z.string().min(1).nullable(),
  timeInRangePercent: nullableNumber,
  gmiPercent: nullableNumber,
  cvPercent: nullableNumber,
  sensorUsePercent: z.number(),
  zoneDistribution: ZoneDistributionDtoSchema,
  hypoEpisodes: z.number(),
  alertsCount: z.number(),
});

/** `GET /professional/patients` (PRO-03). */
export const PatientPageDtoSchema = z.object({
  items: z.array(PatientRowDtoSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

const CohortPatientDtoSchema = z.object({
  patientId: z.string().min(1),
  fullName: z.string().nullable(),
  initials: z.string().min(1),
  timeInRangePercent: nullableNumber,
  cvPercent: nullableNumber,
  zoneDistribution: ZoneDistributionDtoSchema,
});

/** `GET /professional/cohort/summary` (PRO-09, PRO-10). */
export const CohortSummaryDtoSchema = z.object({
  patientCount: z.number(),
  avgTimeInRangePercent: nullableNumber,
  avgGmiPercent: nullableNumber,
  patientsWithHypo: z.number(),
  patientsStale: z.number(),
  perPatient: z.array(CohortPatientDtoSchema),
  tirHistogram: z.array(z.object({ bucket: z.enum(['lt50', '50to70', 'gte70']), count: z.number() })),
  hypoByHour: z.array(z.object({ hour: z.number(), count: z.number() })),
});

/** `POST /sharing/redeem` answers `201` (new link) or `200` (already linked) with the same body (CON-04). */
export const RedeemDtoSchema = z.object({
  patientId: z.string().min(1),
  grantId: z.string().min(1),
});

export type PatientPageDto = z.infer<typeof PatientPageDtoSchema>;
export type CohortSummaryDto = z.infer<typeof CohortSummaryDtoSchema>;

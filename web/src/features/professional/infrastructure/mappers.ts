import type { CohortPatient, CohortSummary, PatientPage, PatientRow } from '../domain/cohort';
import type { CohortSummaryDto, PatientPageDto } from './schemas';

/** The name to show: the full name, or the initials the gateway sends when it has none (PRO-15). */
function displayNameOf(fullName: string | null, initials: string): string {
  return fullName?.trim() || initials;
}

type PatientRowDto = PatientPageDto['items'][number];
type CohortPatientDto = CohortSummaryDto['perPatient'][number];

function toPatientRow(dto: PatientRowDto): PatientRow {
  return {
    patientId: dto.patientId,
    fullName: dto.fullName,
    initials: dto.initials,
    displayName: displayNameOf(dto.fullName, dto.initials),
    lastReadingAt: dto.lastReadingAt,
    timeInRangePercent: dto.timeInRangePercent,
    gmiPercent: dto.gmiPercent,
    cvPercent: dto.cvPercent,
    sensorUsePercent: dto.sensorUsePercent,
    zoneDistribution: { ...dto.zoneDistribution },
    hypoEpisodes: dto.hypoEpisodes,
    alertsCount: dto.alertsCount,
  };
}

function toCohortPatient(dto: CohortPatientDto): CohortPatient {
  return {
    patientId: dto.patientId,
    fullName: dto.fullName,
    initials: dto.initials,
    displayName: displayNameOf(dto.fullName, dto.initials),
    timeInRangePercent: dto.timeInRangePercent,
    cvPercent: dto.cvPercent,
    zoneDistribution: { ...dto.zoneDistribution },
  };
}

/** Turns the validated list DTO into the domain page, copying so no DTO object leaks inward (ARQ-06). */
export function toPatientPage(dto: PatientPageDto): PatientPage {
  return { items: dto.items.map(toPatientRow), page: dto.page, limit: dto.limit, total: dto.total };
}

export function toCohortSummary(dto: CohortSummaryDto): CohortSummary {
  return {
    patientCount: dto.patientCount,
    avgTimeInRangePercent: dto.avgTimeInRangePercent,
    avgGmiPercent: dto.avgGmiPercent,
    patientsWithHypo: dto.patientsWithHypo,
    patientsStale: dto.patientsStale,
    perPatient: dto.perPatient.map(toCohortPatient),
    tirHistogram: dto.tirHistogram.map((band) => ({ ...band })),
    hypoByHour: dto.hypoByHour.map((hour) => ({ ...hour })),
  };
}

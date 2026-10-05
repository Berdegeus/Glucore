// What the professional's portfolio is made of and the ports that fetch it
// (ARQ-05). Shapes follow `GET /professional/patients`,
// `GET /professional/cohort/summary` and `POST /sharing/redeem`.

import type { ListedPatient } from './patientList';
import type { ZoneShares } from './risk';

/** The periods the professional can pick, in days (PRO-05). */
export const PORTFOLIO_PERIOD_DAYS = [7, 14, 30, 90] as const;

export type PortfolioPeriodDays = (typeof PORTFOLIO_PERIOD_DAYS)[number];

/** One linked patient in the list: identity, and the metrics of the period (PRO-03). */
export interface PatientRow extends ListedPatient {
  patientId: string;
  /** The name to show: the full name, or the initials when the gateway could not give it (PRO-15). */
  displayName: string;
}

export interface PatientPage {
  items: PatientRow[];
  page: number;
  limit: number;
  total: number;
}

export type TirBucket = 'lt50' | '50to70' | 'gte70';

/** One patient's point in the cohort charts: zones, and the TIR and CV of the scatter (PRO-10). */
export interface CohortPatient {
  patientId: string;
  fullName: string | null;
  initials: string;
  displayName: string;
  timeInRangePercent: number | null;
  cvPercent: number | null;
  zoneDistribution: ZoneShares;
}

export interface CohortSummary {
  patientCount: number;
  avgTimeInRangePercent: number | null;
  avgGmiPercent: number | null;
  patientsWithHypo: number;
  /** Patients with no reading in the last 24 hours. */
  patientsStale: number;
  perPatient: CohortPatient[];
  /** How many patients fall in each TIR band. */
  tirHistogram: { bucket: TirBucket; count: number }[];
  /** Hypoglycemia episodes by hour of the day, 0 to 23. */
  hypoByHour: { hour: number; count: number }[];
}

/** The link an invite code opened (CON-04). */
export interface RedeemResult {
  patientId: string;
  grantId: string;
}

export interface PatientsQuery {
  days: number;
  page: number;
  limit: number;
  /** IANA zone the days are counted in. */
  timeZone: string;
}

export interface CohortQuery {
  days: number;
  timeZone: string;
}

export interface ProfessionalRepository {
  /**
   * Rejects with `forbidden` (`FORBIDDEN_ROLE`, or `NO_ACTIVE_GRANT` when a link
   * was revoked), `validation`, `unauthenticated` or `unavailable`.
   */
  listPatients(query: PatientsQuery): Promise<PatientPage>;
  /** Same errors as `listPatients`. */
  cohort(query: CohortQuery): Promise<CohortSummary>;
}

export interface RedeemRepository {
  /**
   * Rejects with `validation` (`INVALID_INVITE`, the same for every bad code),
   * `rate-limited` or `forbidden` (not a professional).
   */
  redeem(code: string): Promise<RedeemResult>;
}

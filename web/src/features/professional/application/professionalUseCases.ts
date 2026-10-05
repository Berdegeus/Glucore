import { AppError } from '../../../shared/domain/appError';
import type { TimeZoneProvider } from '../../../shared/domain/ports';
import {
  PORTFOLIO_PERIOD_DAYS,
  type CohortSummary,
  type PatientPage,
  type ProfessionalRepository,
  type RedeemRepository,
  type RedeemResult,
} from '../domain/cohort';

export const DEFAULT_PAGE_LIMIT = 50;
/** The largest page the API serves (PRO-16). */
export const MAX_PAGE_LIMIT = 200;

/** `code` of the `validation` error for a period outside 7, 14, 30 and 90 days. */
export const INVALID_PERIOD_CODE = 'INVALID_PERIOD';
/** `code` of the `validation` error for a page or limit out of range. */
export const INVALID_PAGINATION_CODE = 'INVALID_PAGINATION';
/** The server's code for any bad invite; an empty field gets it too, without a request. */
export const INVALID_INVITE_CODE = 'INVALID_INVITE';

export interface ProfessionalUseCaseDeps {
  professionals: ProfessionalRepository;
  redemptions: RedeemRepository;
  /** The browser's zone: the days of the portfolio are cut in it. */
  timeZone: TimeZoneProvider;
}

export interface LoadPatientsInput {
  days: number;
  page?: number;
  limit?: number;
}

export interface ProfessionalUseCases {
  loadPatients(input: LoadPatientsInput): Promise<PatientPage>;
  loadCohort(input: { days: number }): Promise<CohortSummary>;
  redeemInvite(code: string): Promise<RedeemResult>;
}

function checkPeriod(days: number): void {
  if (!(PORTFOLIO_PERIOD_DAYS as readonly number[]).includes(days)) {
    throw new AppError('validation', { code: INVALID_PERIOD_CODE });
  }
}

function checkPagination(page: number, limit: number): void {
  const pageOk = Number.isInteger(page) && page >= 1;
  const limitOk = Number.isInteger(limit) && limit >= 1 && limit <= MAX_PAGE_LIMIT;
  if (!pageOk || !limitOk) throw new AppError('validation', { code: INVALID_PAGINATION_CODE });
}

/** Trimmed, with the spaces and hyphens a code is often shown with removed, in capitals (CON-04). */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * The professional's use cases (PRO-02, PRO-05, CON-04). A period the portfolio
 * does not offer, or a page out of range, fails with a `validation` error and
 * the repository is never called; the browser zone always goes along. An invite
 * code is normalized before it is sent, and an empty one is refused here.
 */
export function createProfessionalUseCases({ professionals, redemptions, timeZone }: ProfessionalUseCaseDeps): ProfessionalUseCases {
  return {
    async loadPatients({ days, page = 1, limit = DEFAULT_PAGE_LIMIT }) {
      checkPeriod(days);
      checkPagination(page, limit);
      return professionals.listPatients({ days, page, limit, timeZone: timeZone.timeZone() });
    },
    async loadCohort({ days }) {
      checkPeriod(days);
      return professionals.cohort({ days, timeZone: timeZone.timeZone() });
    },
    async redeemInvite(code) {
      const normalized = normalizeInviteCode(code);
      if (normalized === '') throw new AppError('validation', { code: INVALID_INVITE_CODE });
      return redemptions.redeem(normalized);
    },
  };
}

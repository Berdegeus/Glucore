import type { ServiceRegistry, UserRoleName } from '@glucore/shared';

import { InternalHttpClient } from './internalHttpClient';
import { GATEWAY_SERVICE_IDENTITY } from './serviceIdentity';

/** One link of a patient's consent, as glucose-service lists it. */
export interface GrantSummary {
  id: string;
  professionalId: string;
  specialty: string;
  grantedAt: string;
}

/** An entry of the professional's portfolio; only the patient id matters to the composition, the rest passes through. */
export type PortfolioEntry = { patientId: string } & Record<string, unknown>;

/** `GET /professional/patients` as glucose-service answers it: metrics only, no names. */
export type PatientListResponse = { items: PortfolioEntry[] } & Record<string, unknown>;

/** `GET /professional/cohort/summary` as glucose-service answers it: `perPatient` carries no names. */
export type CohortSummaryResponse = { perPatient: PortfolioEntry[] } & Record<string, unknown>;

/** `GET /internal/admin/stats` as glucose-service answers it: counts only. */
export interface PlatformStatsResponse {
  activePatients: { last24h: number; last7d: number; registered: number };
  readingsByDay: { day: string; count: number }[];
  grants: { active: number; createdByWeek: { weekStart: string; count: number }[] };
  alertsByType: { alertType: string; count: number }[];
}

/**
 * Every call this service makes into glucose-service: `/internal/*` with an
 * internal token, plus the one public route (`listGrants`) it composes on the
 * end user's own token.
 */
export class GlucoseClient {
  private readonly http: InternalHttpClient;

  constructor(registry: ServiceRegistry, internalJwtSecret: string) {
    this.http = new InternalHttpClient(registry, 'glucose', internalJwtSecret);
  }

  /**
   * Identity comes from the token's `sub`, not a body field: by the time the
   * saga calls this, auth-service has already created the account, so the
   * real userId is known — see `patient.routes.ts` on the receiving end.
   */
  createPatient(userId: string, role: UserRoleName, input: Record<string, unknown>): Promise<unknown> {
    return this.http.request('POST', '/internal/patients', { sub: userId, role }, input);
  }

  getPatient(userId: string, role: UserRoleName): Promise<unknown> {
    return this.http.request('GET', '/internal/patients/me', { sub: userId, role });
  }

  updatePatient(userId: string, role: UserRoleName, input: Record<string, unknown>): Promise<unknown> {
    return this.http.request('PUT', '/internal/patients/me', { sub: userId, role }, input);
  }

  deletePatient(userId: string): Promise<void> {
    return this.http.request('DELETE', `/internal/patients/${userId}`, GATEWAY_SERVICE_IDENTITY);
  }

  /**
   * Same identity rule as `createPatient`: the token's `sub` is the userId the
   * account call just produced, and the role is fixed here, not taken from the
   * caller, because only a professional registration reaches this method.
   */
  createProfessional(userId: string, input: Record<string, unknown>): Promise<unknown> {
    return this.http.request('POST', '/internal/professionals', { sub: userId, role: 'HEALTH_PROFESSIONAL' }, input);
  }

  getProfessional(userId: string): Promise<unknown> {
    return this.http.request('GET', '/internal/professionals/me', { sub: userId, role: 'HEALTH_PROFESSIONAL' });
  }

  deleteProfessional(userId: string): Promise<void> {
    return this.http.request('DELETE', `/internal/professionals/${userId}`, GATEWAY_SERVICE_IDENTITY);
  }

  /**
   * Platform counts for the administrator. `userId` is the admin the request
   * came from; the role is fixed here and checked again by glucose-service
   * (ADM-05).
   */
  adminStats(userId: string, days: number): Promise<PlatformStatsResponse> {
    return this.http.request('GET', `/internal/admin/stats?days=${days}`, { sub: userId, role: 'ADMINISTRATOR' });
  }

  /**
   * The patient's own grants, asked with the patient's own token: this is the
   * public `/sharing/grants` route, protected by the user's JWT, not an
   * internal one, so glucose-service decides who the caller is and whether the
   * role may ask.
   */
  listGrants(authorization: string): Promise<{ grants: GrantSummary[] }> {
    return this.http.forward('GET', '/sharing/grants', authorization);
  }

  /**
   * The professional's portfolio, asked with the professional's own token like
   * `listGrants`: glucose-service decides the role and the grants. `search` is
   * the caller's query string (`?days=7&page=2`, or empty), passed on as it came
   * so glucose-service stays the one place that validates it.
   */
  listPatients(authorization: string, search = ''): Promise<PatientListResponse> {
    return this.http.forward('GET', `/professional/patients${search}`, authorization);
  }

  cohortSummary(authorization: string, search = ''): Promise<CohortSummaryResponse> {
    return this.http.forward('GET', `/professional/cohort/summary${search}`, authorization);
  }
}

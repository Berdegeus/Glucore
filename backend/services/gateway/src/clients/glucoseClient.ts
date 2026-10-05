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
   * The patient's own grants, asked with the patient's own token: this is the
   * public `/sharing/grants` route, protected by the user's JWT, not an
   * internal one, so glucose-service decides who the caller is and whether the
   * role may ask.
   */
  listGrants(authorization: string): Promise<{ grants: GrantSummary[] }> {
    return this.http.forward('GET', '/sharing/grants', authorization);
  }
}

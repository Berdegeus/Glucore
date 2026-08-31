import type { ServiceRegistry, UserRoleName } from '@glucore/shared';

import { InternalHttpClient } from './internalHttpClient';
import { GATEWAY_SERVICE_IDENTITY } from './serviceIdentity';

/** Every call this service makes into glucose-service, all going through `/internal/*`. */
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
}

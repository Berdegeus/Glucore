import type { ServiceRegistry, UserRoleName } from '@glucore/shared';

import { InternalHttpClient } from './internalHttpClient';
import { GATEWAY_SERVICE_IDENTITY } from './serviceIdentity';

export interface RegisterAccountInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface RegisterAccountResult {
  userId: string;
  token: string;
}

/** Every call this service makes into auth-service, all going through `/internal/*`. */
export class AuthClient {
  private readonly http: InternalHttpClient;

  constructor(registry: ServiceRegistry, internalJwtSecret: string) {
    this.http = new InternalHttpClient(registry, 'auth', internalJwtSecret);
  }

  register(input: RegisterAccountInput): Promise<RegisterAccountResult> {
    return this.http.request('POST', '/internal/accounts', GATEWAY_SERVICE_IDENTITY, input);
  }

  getAccount(userId: string, role: UserRoleName): Promise<unknown> {
    return this.http.request('GET', '/internal/accounts/me', { sub: userId, role });
  }

  updateAccount(userId: string, role: UserRoleName, input: Record<string, unknown>): Promise<void> {
    return this.http.request('PUT', '/internal/accounts/me', { sub: userId, role }, input);
  }

  deleteAccount(userId: string): Promise<void> {
    return this.http.request('DELETE', `/internal/accounts/${userId}`, GATEWAY_SERVICE_IDENTITY);
  }
}

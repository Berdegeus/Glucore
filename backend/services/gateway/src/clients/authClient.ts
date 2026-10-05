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

/** The most ids auth-service accepts in one lookup; larger lists are split into chunks of this size. */
export const LOOKUP_BATCH_SIZE = 200;

/** Every call this service makes into auth-service, all going through `/internal/*`. */
export class AuthClient {
  private readonly http: InternalHttpClient;

  constructor(registry: ServiceRegistry, internalJwtSecret: string) {
    this.http = new InternalHttpClient(registry, 'auth', internalJwtSecret);
  }

  register(input: RegisterAccountInput): Promise<RegisterAccountResult> {
    return this.http.request('POST', '/internal/accounts', GATEWAY_SERVICE_IDENTITY, input);
  }

  /** The role is fixed by the route on the receiving end; a `role` in the input would be ignored there. */
  registerProfessional(input: RegisterAccountInput): Promise<RegisterAccountResult> {
    return this.http.request('POST', '/internal/accounts/professional', GATEWAY_SERVICE_IDENTITY, input);
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

  /**
   * Display names by account id. Ids with no account are simply absent from the
   * map, and an empty list never reaches the network.
   */
  async lookupAccounts(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const unique = [...new Set(ids)];

    for (let start = 0; start < unique.length; start += LOOKUP_BATCH_SIZE) {
      const chunk = unique.slice(start, start + LOOKUP_BATCH_SIZE);
      const found = await this.http.request<{ id: string; fullName: string }[]>(
        'POST',
        '/internal/accounts/lookup',
        GATEWAY_SERVICE_IDENTITY,
        { ids: chunk },
      );
      for (const { id, fullName } of found) names.set(id, fullName);
    }

    return names;
  }
}

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

/** Query of the administrators' account list; auth-service is the one place that validates it. */
export interface AdminUsersQuery {
  role?: string;
  status?: string;
  q?: string;
  page?: string;
  limit?: string;
}

/** Account totals and sign-ups, as auth-service answers `GET /internal/admin/stats`. */
export interface AccountStatsResponse {
  accounts: Record<string, unknown>;
  registrationsInPeriod: number;
  registrationsByDay: { day: string; count: number }[];
}

/** One page of the account list, as auth-service answers `GET /internal/admin/users`. */
export interface AdminUsersPage {
  items: Record<string, unknown>[];
  page: number;
  limit: number;
  total: number;
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
   * The administrator's views of the identity database. `userId` is the admin
   * the request came from: it travels as the internal token's `sub` with the
   * role fixed here, so auth-service audits the right person and checks the
   * role again on its side (ADM-05).
   */
  adminStats(userId: string, days: number): Promise<AccountStatsResponse> {
    return this.http.request('GET', `/internal/admin/stats?days=${days}`, { sub: userId, role: 'ADMINISTRATOR' });
  }

  adminUsers(userId: string, query: AdminUsersQuery = {}): Promise<AdminUsersPage> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, value);
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    return this.http.request('GET', `/internal/admin/users${suffix}`, { sub: userId, role: 'ADMINISTRATOR' });
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

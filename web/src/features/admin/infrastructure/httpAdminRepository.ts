import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { AccountPage, AdminOverview, AdminPeriodDays, AdminRepository, AdminUsersQuery } from '../domain/overview';
import { toAccountPage, toAdminOverview } from './mappers';
import { AccountPageDtoSchema, AdminOverviewDtoSchema } from './schemas';

/** The query string of the account list: a filter left out, or a blank search, is not sent. */
function usersSearch({ role, status, q, page, limit }: AdminUsersQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  if (q?.trim()) params.set('q', q.trim());
  params.set('page', String(page));
  params.set('limit', String(limit));
  return params;
}

/**
 * `GET /admin/overview` and `GET /admin/users` (ADM-01, ADM-04). Any other
 * role gets `403 FORBIDDEN_ROLE` (ADM-05), which surfaces as a `forbidden`
 * error that carries the code; a service down is `unavailable`.
 */
export class HttpAdminRepository implements AdminRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async overview(days: AdminPeriodDays): Promise<AdminOverview> {
    return toAdminOverview(await this.api.fetchDto({ path: `/admin/overview?days=${days}` }, AdminOverviewDtoSchema));
  }

  async users(query: AdminUsersQuery): Promise<AccountPage> {
    return toAccountPage(await this.api.fetchDto({ path: `/admin/users?${usersSearch(query).toString()}` }, AccountPageDtoSchema));
  }
}

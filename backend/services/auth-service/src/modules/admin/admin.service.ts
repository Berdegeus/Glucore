import type { AuditContext, RecordAudit } from '@glucore/shared';

import { recordAudit } from '../../lib/audit';

import { toAdminUserDto, type AdminUsersPageDto } from './admin.mapper';
import type { AdminRepository } from './admin.repository';
import type { UserListQuery } from './admin.schema';

/**
 * What an administrator sees of the identity database: account totals and a
 * searchable list. Who the admin is comes from the internal token, never from
 * the request (ADM-05).
 */
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly audit: RecordAudit = recordAudit,
  ) {}

  /**
   * One page of accounts. Every read is audited (ADM-06), with the filters and
   * the page asked for but never the rows returned: the trail says who looked
   * for what, not what they saw.
   */
  async listUsers(
    adminId: string,
    query: UserListQuery,
    context: AuditContext,
  ): Promise<AdminUsersPageDto> {
    const { rows, total } = await this.admin.listUsers(
      { role: query.role, status: query.status, q: query.q },
      { skip: (query.page - 1) * query.limit, take: query.limit },
    );

    await this.audit({
      userId: adminId,
      entity: 'User',
      action: 'ADMIN_LIST_USERS',
      metadata: {
        role: query.role ?? null,
        status: query.status ?? null,
        q: query.q ?? null,
        page: query.page,
        limit: query.limit,
      },
      ...context,
    });

    return { items: rows.map(toAdminUserDto), page: query.page, limit: query.limit, total };
  }
}

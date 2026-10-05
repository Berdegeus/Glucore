import type { Response } from 'express';
import { parseAdminRangeDays } from '@glucore/shared';

import type { AdminUsersQuery, AuthClient } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';
import type { GatewayRequest } from '../../middleware/authenticate';

const USER_QUERY_KEYS = ['role', 'status', 'q', 'page', 'limit'] as const;

export class AdminController {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  /**
   * API Composition over both databases: the accounts and sign-ups are auth's,
   * the patients, readings, grants and alerts are glucose's. Both legs are
   * required: half an overview would show a platform that looks emptier than it
   * is, so a failure in either one is the answer (503 when a service is
   * unreachable, through the upstream classifier) and nothing is degraded.
   *
   * The body is rebuilt field by field rather than spread, so a field a service
   * adds later reaches the admin only when this list says so (ADM-03).
   */
  overview = async (req: GatewayRequest, res: Response): Promise<void> => {
    const days = parseAdminRangeDays(req.query.days);
    const adminId = req.userId as string;

    const [accountStats, platformStats] = await Promise.all([
      this.authClient.adminStats(adminId, days),
      this.glucoseClient.adminStats(adminId, days),
    ]);

    res.json({
      accounts: accountStats.accounts,
      registrationsInPeriod: accountStats.registrationsInPeriod,
      registrationsByDay: accountStats.registrationsByDay,
      activePatients: platformStats.activePatients,
      readingsByDay: platformStats.readingsByDay,
      grants: platformStats.grants,
      alertsByType: platformStats.alertsByType,
    });
  };

  /**
   * The account list is auth's alone, so this is a pass-through of its page.
   * Only the known parameters are forwarded; auth-service validates them and
   * audits the read against the admin, whose id travels in the internal token.
   */
  users = async (req: GatewayRequest, res: Response): Promise<void> => {
    const query: AdminUsersQuery = {};
    for (const key of USER_QUERY_KEYS) {
      const value = req.query[key];
      if (value === undefined) continue;
      query[key] = Array.isArray(value) ? value.map(String) : String(value);
    }

    res.json(await this.authClient.adminUsers(req.userId as string, query));
  };
}

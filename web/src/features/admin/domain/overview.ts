// What the administrator sees of the platform and the port that fetches it
// (ARQ-05). Shapes follow `GET /admin/overview` and `GET /admin/users`. Only
// counts and account rows travel here: no reading, carb, insulin or alert of
// an identifiable person (ADM-03).

import type { Role } from '../../../shared/domain/role';

/** The periods the administrator can pick, in days (ADM-07). */
export type AdminPeriodDays = 7 | 30 | 90;

/** Same values as the backend's `UserStatus` enum. */
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

/** How many of something fell on one day, `YYYY-MM-DD`; the API fills the days with no event with zero. */
export interface DayCount {
  day: string;
  count: number;
}

/** The platform in aggregates over a period (ADM-01, ADM-02). Every role and status comes, with zero when none. */
export interface AdminOverview {
  accounts: {
    total: number;
    byRole: { role: Role; count: number }[];
    byStatus: { status: AccountStatus; count: number }[];
  };
  registrationsInPeriod: number;
  registrationsByDay: DayCount[];
  activePatients: {
    /** Patients with a reading in the last 24 hours. */
    last24h: number;
    /** Patients with a reading in the last 7 days. */
    last7d: number;
    /** Every patient registered. */
    registered: number;
  };
  readingsByDay: DayCount[];
  grants: {
    active: number;
    /** Links created per week; `weekStart` is the week's first day, `YYYY-MM-DD`. */
    createdByWeek: { weekStart: string; count: number }[];
  };
  alertsByType: { alertType: string; count: number }[];
}

/** One account in the administrator's list (ADM-04). */
export interface AccountRow {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: AccountStatus;
  /** ISO 8601 instant. */
  createdAt: string;
}

export interface AccountPage {
  items: AccountRow[];
  page: number;
  limit: number;
  total: number;
}

/** The filters of the account list (ADM-04); a filter left out is not applied. */
export interface AdminUsersQuery {
  role?: Role;
  status?: AccountStatus;
  /** Matched against the name or the e-mail. */
  q?: string;
  page: number;
  limit: number;
}

export interface AdminRepository {
  /** Rejects with `forbidden` (`FORBIDDEN_ROLE`), `validation`, `unauthenticated` or `unavailable`. */
  overview(days: AdminPeriodDays): Promise<AdminOverview>;
  /** Same errors as `overview`. */
  users(query: AdminUsersQuery): Promise<AccountPage>;
}

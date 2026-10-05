import type { AccountPage, AccountRow, AdminOverview } from '../features/admin/domain/overview';

/** `GET /admin/overview` as the gateway answers it: every role and status listed, days filled. */
export function overviewDto(overrides: Record<string, unknown> = {}) {
  return {
    accounts: {
      total: 42,
      byRole: [
        { role: 'PATIENT', count: 35 },
        { role: 'HEALTH_PROFESSIONAL', count: 6 },
        { role: 'ADMINISTRATOR', count: 1 },
      ],
      byStatus: [
        { status: 'ACTIVE', count: 38 },
        { status: 'INACTIVE', count: 3 },
        { status: 'BLOCKED', count: 1 },
      ],
    },
    registrationsInPeriod: 9,
    registrationsByDay: [
      { day: '2026-08-05', count: 4 },
      { day: '2026-08-06', count: 5 },
    ],
    activePatients: { last24h: 18, last7d: 27, registered: 35 },
    readingsByDay: [
      { day: '2026-08-05', count: 5120 },
      { day: '2026-08-06', count: 4980 },
    ],
    grants: {
      active: 14,
      createdByWeek: [
        { weekStart: '2026-07-27', count: 3 },
        { weekStart: '2026-08-03', count: 2 },
      ],
    },
    alertsByType: [
      { alertType: 'LOW', count: 21 },
      { alertType: 'HIGH', count: 40 },
    ],
    ...overrides,
  };
}

/** The domain overview for `overviewDto()`, for use-case and widget tests that do not go over HTTP. */
export function overviewOf(overrides: Partial<AdminOverview> = {}): AdminOverview {
  return { ...(overviewDto() as AdminOverview), ...overrides };
}

/** A row of `GET /admin/users` as the gateway answers it. */
export function accountRowDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    fullName: 'Ana Souza',
    email: 'ana@example.com',
    role: 'PATIENT',
    status: 'ACTIVE',
    createdAt: '2026-05-03T19:08:32.000Z',
    ...overrides,
  };
}

export function accountPageDto(items: unknown[] = [accountRowDto()]) {
  return { items, page: 1, limit: 25, total: items.length };
}

export function accountPageOf(items: AccountRow[] = [accountRowDto() as AccountRow]): AccountPage {
  return { items, page: 1, limit: 25, total: items.length };
}

/** A platform where nothing happened: every count zero, every role and status still listed. */
export function zeroOverviewOf(): AdminOverview {
  const base = overviewOf();
  return {
    accounts: {
      total: 0,
      byRole: base.accounts.byRole.map(({ role }) => ({ role, count: 0 })),
      byStatus: base.accounts.byStatus.map(({ status }) => ({ status, count: 0 })),
    },
    registrationsInPeriod: 0,
    registrationsByDay: base.registrationsByDay.map(({ day }) => ({ day, count: 0 })),
    activePatients: { last24h: 0, last7d: 0, registered: 0 },
    readingsByDay: base.readingsByDay.map(({ day }) => ({ day, count: 0 })),
    grants: { active: 0, createdByWeek: base.grants.createdByWeek.map(({ weekStart }) => ({ weekStart, count: 0 })) },
    alertsByType: base.alertsByType.map(({ alertType }) => ({ alertType, count: 0 })),
  };
}

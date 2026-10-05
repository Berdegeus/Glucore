import type { AccountPage, AdminOverview } from '../domain/overview';
import type { AccountPageDto, AdminOverviewDto } from './schemas';

const copyAll = <T extends object>(items: readonly T[]): T[] => items.map((item) => ({ ...item }));

/** Turns the validated overview DTO into the domain one, copying so no DTO object leaks inward (ARQ-06). */
export function toAdminOverview(dto: AdminOverviewDto): AdminOverview {
  return {
    accounts: { total: dto.accounts.total, byRole: copyAll(dto.accounts.byRole), byStatus: copyAll(dto.accounts.byStatus) },
    registrationsInPeriod: dto.registrationsInPeriod,
    registrationsByDay: copyAll(dto.registrationsByDay),
    activePatients: { ...dto.activePatients },
    readingsByDay: copyAll(dto.readingsByDay),
    grants: { active: dto.grants.active, createdByWeek: copyAll(dto.grants.createdByWeek) },
    alertsByType: copyAll(dto.alertsByType),
  };
}

export function toAccountPage(dto: AccountPageDto): AccountPage {
  return { items: copyAll(dto.items), page: dto.page, limit: dto.limit, total: dto.total };
}

import type { Role } from '../../../../shared/domain/role';
import { formatNumber } from '../../../../shared/presentation/format';
import { DEFAULT_USERS_LIMIT, type LoadUsersInput } from '../../application/adminUseCases';
import type { AccountStatus } from '../../domain/overview';

/** Accounts per page of the table (ADM-04). */
export const PAGE_SIZE = DEFAULT_USERS_LIMIT;

/** How long the search box must rest before the list is asked for again. */
export const SEARCH_DELAY_MS = 300;

/** The statuses in the order of the filter. */
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];

/** What the administrator chose to see: a role and a status (or any), and the text to look for. */
export interface UsersView {
  role: Role | '';
  status: AccountStatus | '';
  search: string;
}

export const EMPTY_VIEW: UsersView = { role: '', status: '', search: '' };

/** The filters the list is asked for; one left empty is not sent. */
export function filtersOf({ role, status }: UsersView, query: string): LoadUsersInput {
  return { role: role || undefined, status: status || undefined, q: query.trim() || undefined };
}

/** How many pages `total` accounts take; at least one, so an empty list still reads "página 1 de 1". */
export const pageCount = (total: number): number => Math.max(1, Math.ceil(total / PAGE_SIZE));

/** `1 conta`, `120 contas`. */
export const accountsText = (total: number): string => `${formatNumber(total, 0)} ${total === 1 ? 'conta' : 'contas'}`;

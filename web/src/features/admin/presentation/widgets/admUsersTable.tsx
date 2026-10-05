import { useState } from 'react';
import { QueryWidget, type WidgetProps } from '../../../dashboard-layout';
import type { AccountPage } from '../../domain/overview';
import { useAdminDays } from '../adminPeriodContext';
import { useDebouncedValue } from '../useDebouncedValue';
import { useUsers } from '../useOverview';
import styles from './admUsersTable.module.css';
import { UsersFilters, UsersPager } from './usersTableControls';
import { EMPTY_VIEW, filtersOf, PAGE_SIZE, SEARCH_DELAY_MS, type UsersView } from './usersTableModel';
import { UsersTableView } from './usersTableView';
import { ADM_USERS_TABLE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its table code.
export { admUsersTableDefinition } from './admUsersTable.definition';

export { ADM_USERS_TABLE_TITLE };

/** The cause when the filters leave no account. */
export const NO_ACCOUNTS_CAUSE = 'Nenhuma conta encontrada';

// The list never leaves the widget empty: the filters that produced an empty page must stay on screen to be changed.
const NEVER_EMPTY = (): boolean => false;

interface UsersBodyProps {
  page: AccountPage;
  view: UsersView;
  onView: (view: UsersView) => void;
  onPage: (page: number) => void;
}

function UsersBody({ page, view, onView, onPage }: UsersBodyProps) {
  return (
    <>
      <UsersFilters view={view} onChange={onView} />
      {page.items.length === 0 ? (
        <p className={styles.none} role="status">
          {NO_ACCOUNTS_CAUSE}
        </p>
      ) : (
        <UsersTableView rows={page.items} />
      )}
      <UsersPager page={page.page} total={page.total} onPage={onPage} />
    </>
  );
}

function UsersTableWidget({ size }: WidgetProps) {
  const [view, setView] = useState<UsersView>(EMPTY_VIEW);
  const query = useDebouncedValue(view.search, SEARCH_DELAY_MS);
  const filters = filtersOf(view, query);
  // The page belongs to the filters it was picked under: another filter reads page 1 again, with no effect to chase it.
  const filterKey = JSON.stringify(filters);
  const [paging, setPaging] = useState({ filterKey, page: 1 });
  const page = paging.filterKey === filterKey ? paging.page : 1;
  // `keepPrevious`: the table and its pager stay on screen while the next page loads, so focus stays on the control.
  const result = useUsers({ ...filters, page, limit: PAGE_SIZE }, true);
  return (
    <QueryWidget query={result} title={ADM_USERS_TABLE_TITLE} size={size} isEmpty={NEVER_EMPTY} emptyCause="">
      {(accounts) => <UsersBody page={accounts} view={view} onView={setView} onPage={(next) => setPaging({ filterKey, page: next })} />}
    </QueryWidget>
  );
}

/**
 * The accounts of the platform as a table: name, e-mail, role, status in words, shape and hue, and the day it was
 * created (ADM-04). The role and status filters and the search box (asked for once it rests 300 ms) narrow the list
 * on the server, 25 accounts a page; only account fields appear, nothing clinical (ADM-03). A new period starts
 * over on page 1 with no filter.
 */
export default function AdmUsersTable({ size }: WidgetProps) {
  const days = useAdminDays();
  return <UsersTableWidget key={days} size={size} />;
}

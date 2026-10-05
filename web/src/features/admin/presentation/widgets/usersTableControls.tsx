import { useId, type ChangeEvent } from 'react';
import { ROLES } from '../../../../shared/domain/role';
import { ROLE_NAMES, STATUS_LABELS } from './accountLabels';
import styles from './admUsersTable.module.css';
import { ACCOUNT_STATUSES, accountsText, pageCount, type UsersView } from './usersTableModel';

export const ROLE_FILTER_LABEL = 'Papel';
export const ALL_ROLES_LABEL = 'Todos os papéis';
export const STATUS_FILTER_LABEL = 'Status';
export const ALL_STATUSES_LABEL = 'Todos os status';
export const SEARCH_LABEL = 'Buscar por nome ou e-mail';
export const PAGER_LABEL = 'Paginação da lista de contas';
export const PREVIOUS_LABEL = 'Anterior';
export const NEXT_LABEL = 'Próxima';

interface FiltersProps {
  view: UsersView;
  onChange: (view: UsersView) => void;
}

/** The role and status filters and the search box of the account list (ADM-04). */
export function UsersFilters({ view, onChange }: FiltersProps) {
  const ids = { role: useId(), status: useId(), search: useId() };
  // The option's value is one of the roles or empty; finding it keeps the type honest without a cast.
  const chooseRole = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...view, role: ROLES.find((role) => role === event.target.value) ?? '' });
  const chooseStatus = (event: ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...view, status: ACCOUNT_STATUSES.find((status) => status === event.target.value) ?? '' });
  return (
    <div className={styles.filters}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.role}>
          {ROLE_FILTER_LABEL}
        </label>
        <select id={ids.role} className={styles.control} value={view.role} onChange={chooseRole}>
          <option value="">{ALL_ROLES_LABEL}</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_NAMES[role]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.status}>
          {STATUS_FILTER_LABEL}
        </label>
        <select id={ids.status} className={styles.control} value={view.status} onChange={chooseStatus}>
          <option value="">{ALL_STATUSES_LABEL}</option>
          {ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.search}>
          {SEARCH_LABEL}
        </label>
        <input
          id={ids.search}
          className={styles.control}
          type="search"
          autoComplete="off"
          value={view.search}
          onChange={(event) => onChange({ ...view, search: event.target.value })}
        />
      </div>
    </div>
  );
}

interface PagerProps {
  page: number;
  total: number;
  onPage: (page: number) => void;
}

/** "Página 1 de 3 · 60 contas" with the buttons to move between the pages of 25 (ADM-04). */
export function UsersPager({ page, total, onPage }: PagerProps) {
  const pages = pageCount(total);
  return (
    <nav className={styles.pager} aria-label={PAGER_LABEL}>
      <button type="button" className={styles.pageButton} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {PREVIOUS_LABEL}
      </button>
      <p className={styles.pageInfo} aria-live="polite">
        Página {page} de {pages} · {accountsText(total)}
      </p>
      <button type="button" className={styles.pageButton} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {NEXT_LABEL}
      </button>
    </nav>
  );
}

import { browserTimeZone } from '../../../../shared/presentation/browserTimeZone';
import { formatDate } from '../../../../shared/presentation/format';
import type { AccountRow } from '../../domain/overview';
import { ROLE_NAMES, STATUS_ICONS, STATUS_LABELS } from './accountLabels';
import styles from './admUsersTable.module.css';

/** Accessible name of the part that scrolls, so a keyboard user can focus and scroll it. */
export const USERS_SCROLL_LABEL = 'Tabela de contas, role para ver todas as colunas';
export const USERS_TABLE_CAPTION = 'Contas da plataforma';

/** The columns of the table, left to right: only what identifies an account, never anything clinical (ADM-03). */
export const USERS_COLUMNS = ['Nome', 'E-mail', 'Papel', 'Status', 'Criada em'] as const;

/** The status of an account in words, a shape and a hue: never the hue alone (RSP-08). */
function StatusBadge({ status }: { status: AccountRow['status'] }) {
  return (
    <span className={styles.badge} data-status={status}>
      <span aria-hidden="true">{STATUS_ICONS[status]}</span>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** The page of accounts, in the order the API sends them (ADM-04). */
export function UsersTableView({ rows }: { rows: readonly AccountRow[] }) {
  const timeZone = browserTimeZone();
  return (
    // A scrollable region must take focus, or a keyboard cannot reach the columns it hides (RSP-03).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the scroll area is the control that needs the keyboard
    <div className={styles.scroll} role="region" aria-label={USERS_SCROLL_LABEL} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.hidden}>{USERS_TABLE_CAPTION}</caption>
        <thead>
          <tr>
            {USERS_COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className={styles.name}>
                {row.fullName}
              </th>
              <td>{row.email}</td>
              <td>{ROLE_NAMES[row.role]}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>{formatDate(row.createdAt, timeZone)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

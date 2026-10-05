import { Link } from 'react-router';
import { browserTimeZone } from '../../../../shared/presentation/browserTimeZone';
import type { PatientRow } from '../../domain/cohort';
import { classifyRisk } from '../../domain/risk';
import { metricCells, nextSort, patientPath, TABLE_COLUMNS, type SortState } from './patientsTableModel';
import styles from './proPatientsTable.module.css';
import { RiskBadge } from './riskBadge';

/** Accessible name of the part that scrolls, so a keyboard user can focus and scroll it. */
export const PATIENTS_SCROLL_LABEL = 'Tabela de pacientes, role para ver todas as colunas';
export const PATIENTS_TABLE_CAPTION = 'Pacientes vinculados';

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const SORT_ARROW = { asc: '↑', desc: '↓' } as const;

interface HeaderProps {
  sort: SortState;
  onSort: (sort: SortState) => void;
}

function TableHead({ sort, onSort }: HeaderProps) {
  return (
    <thead>
      <tr>
        {TABLE_COLUMNS.map(({ column, label }) => {
          const active = sort.column === column;
          return (
            <th key={column} scope="col" aria-sort={active ? ARIA_SORT[sort.direction] : undefined}>
              <button type="button" className={styles.sortButton} onClick={() => onSort(nextSort(sort, column))}>
                {label}
                <span aria-hidden="true" className={styles.arrow}>
                  {active ? SORT_ARROW[sort.direction] : ''}
                </span>
              </button>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

function PatientRowView({ row, timeZone }: { row: PatientRow; timeZone: string }) {
  const [lastReading, ...metrics] = metricCells(row, timeZone);
  return (
    <tr>
      <th scope="row" className={styles.name}>
        <Link className={styles.link} to={patientPath(row.patientId)}>
          {row.displayName}
        </Link>
      </th>
      <td>{lastReading}</td>
      {metrics.map((cell, index) => (
        <td key={TABLE_COLUMNS[index + 2]?.column}>{cell}</td>
      ))}
      <td>
        <RiskBadge risk={classifyRisk(row)} />
      </td>
    </tr>
  );
}

interface TableProps extends HeaderProps {
  rows: readonly PatientRow[];
}

/** The page of patients: sortable column headers and, in each row, the link to the patient (PRO-03, PRO-07, PRO-08). */
export function PatientsTableView({ rows, sort, onSort }: TableProps) {
  const timeZone = browserTimeZone();
  return (
    // A scrollable region must take focus, or a keyboard cannot reach the columns it hides (RSP-03).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the scroll area is the control that needs the keyboard
    <div className={styles.scroll} role="region" aria-label={PATIENTS_SCROLL_LABEL} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.hidden}>{PATIENTS_TABLE_CAPTION}</caption>
        <TableHead sort={sort} onSort={onSort} />
        <tbody>
          {rows.map((row) => (
            <PatientRowView key={row.patientId} row={row} timeZone={timeZone} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

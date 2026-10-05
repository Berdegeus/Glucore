import { useId, type ChangeEvent } from 'react';
import { formatNumber } from '../../../../shared/presentation/format';
import { pageCount, RISK_LABELS, RISK_LEVELS, type TableView } from './patientsTableModel';
import styles from './proPatientsTable.module.css';

export const RISK_FILTER_LABEL = 'Nível de risco';
export const ALL_RISKS_LABEL = 'Todos os níveis';
export const SEARCH_LABEL = 'Buscar por nome';
export const PREVIOUS_LABEL = 'Anterior';
export const NEXT_LABEL = 'Próxima';

interface FiltersProps {
  view: Pick<TableView, 'risk' | 'query'>;
  onRisk: (risk: TableView['risk']) => void;
  onQuery: (query: string) => void;
}

/** The risk filter and the name search, which narrow the page on screen (PRO-06). */
export function TableFilters({ view, onRisk, onQuery }: FiltersProps) {
  const ids = { risk: useId(), search: useId() };
  // The option's value is one of the levels or empty; finding it keeps the type honest without a cast.
  const chooseRisk = (event: ChangeEvent<HTMLSelectElement>) => onRisk(RISK_LEVELS.find((level) => level === event.target.value) ?? '');
  return (
    <div className={styles.filters}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.risk}>
          {RISK_FILTER_LABEL}
        </label>
        <select id={ids.risk} className={styles.control} value={view.risk} onChange={chooseRisk}>
          <option value="">{ALL_RISKS_LABEL}</option>
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {RISK_LABELS[level]}
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
          value={view.query}
          onChange={(event) => onQuery(event.target.value)}
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

/** "Página 1 de 3 · 120 pacientes" with the buttons to move between the pages of 50 (PRO-16). */
export function TablePager({ page, total, onPage }: PagerProps) {
  const pages = pageCount(total);
  return (
    <nav className={styles.pager} aria-label="Paginação da lista de pacientes">
      <button type="button" className={styles.pageButton} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {PREVIOUS_LABEL}
      </button>
      <p className={styles.pageInfo} aria-live="polite">
        Página {page} de {pages} · {formatNumber(total, 0)} {total === 1 ? 'paciente' : 'pacientes'}
      </p>
      <button type="button" className={styles.pageButton} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {NEXT_LABEL}
      </button>
    </nav>
  );
}

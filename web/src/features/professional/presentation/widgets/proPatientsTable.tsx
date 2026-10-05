import { useState } from 'react';
import { QueryWidget, type WidgetProps } from '../../../dashboard-layout';
import type { PatientPage } from '../../domain/cohort';
import { usePeriodDays } from '../periodContext';
import { usePatients } from '../usePatients';
import { NO_PATIENTS_CAUSE } from './cohortWidget';
import { TableFilters, TablePager } from './patientsTableControls';
import { DEFAULT_SORT, PAGE_SIZE, visibleRows, type TableView } from './patientsTableModel';
import { PatientsTableView } from './patientsTableView';
import styles from './proPatientsTable.module.css';
import { PRO_PATIENTS_TABLE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its table code.
export { proPatientsTableDefinition } from './proPatientsTable.definition';

export { PRO_PATIENTS_TABLE_TITLE };

/** The cause when the filter leaves no patient of the page on screen. */
export const NO_MATCH_MESSAGE = 'Nenhum paciente corresponde ao filtro';

/** Shown when the gateway could not name the patients and the table lists their initials (PRO-15). */
export const NAMES_UNAVAILABLE_HINT = 'Nomes indisponíveis no momento: os pacientes aparecem pelas iniciais.';

interface PortfolioTableProps {
  page: PatientPage;
  onPage: (page: number) => void;
}

function PortfolioTable({ page, onPage }: PortfolioTableProps) {
  const [view, setView] = useState<TableView>({ risk: '', query: '', sort: DEFAULT_SORT });
  const rows = visibleRows(page.items, view);
  return (
    <>
      <TableFilters view={view} onRisk={(risk) => setView({ ...view, risk })} onQuery={(query) => setView({ ...view, query })} />
      {page.items.some((row) => row.fullName === null) && <p className={styles.hint}>{NAMES_UNAVAILABLE_HINT}</p>}
      {rows.length === 0 ? (
        <p className={styles.none} role="status">
          {NO_MATCH_MESSAGE}
        </p>
      ) : (
        <PatientsTableView rows={rows} sort={view.sort} onSort={(sort) => setView({ ...view, sort })} />
      )}
      <TablePager page={page.page} total={page.total} onPage={onPage} />
    </>
  );
}

function PatientsTableWidget({ days, size }: WidgetProps & { days: number }) {
  const [pageNumber, setPageNumber] = useState(1);
  // `keepPrevious`: the table and its pager stay on screen while the next page loads, so focus stays on the button.
  const query = usePatients(days, pageNumber, PAGE_SIZE, true);
  return (
    <QueryWidget
      query={query}
      title={PRO_PATIENTS_TABLE_TITLE}
      size={size}
      isEmpty={(page) => page.total === 0}
      emptyCause={NO_PATIENTS_CAUSE}
    >
      {(page) => <PortfolioTable page={page} onPage={setPageNumber} />}
    </QueryWidget>
  );
}

/**
 * The portfolio as a table: each linked patient with the metrics of the period and the risk in words, shape and
 * hue (PRO-03). The risk filter, the name search and the column sort narrow and order the page on screen (PRO-06,
 * PRO-07); the list itself comes 50 patients at a time (PRO-16), and a click on a name opens the patient (PRO-08).
 * A new period starts over on page 1 with no filter.
 */
export default function ProPatientsTable({ size }: WidgetProps) {
  const days = usePeriodDays();
  return <PatientsTableWidget key={days} days={days} size={size} />;
}

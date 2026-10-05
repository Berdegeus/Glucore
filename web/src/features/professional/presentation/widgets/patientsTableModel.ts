import { formatDateTime, formatNumber, formatPercent } from '../../../../shared/presentation/format';
import { DEFAULT_PAGE_LIMIT } from '../../application/professionalUseCases';
import type { PatientRow } from '../../domain/cohort';
import { filterPatients, sortPatients, type SortColumn, type SortDirection } from '../../domain/patientList';
import type { RiskLevel } from '../../domain/risk';

/** Patients per page of the table (PRO-16). */
export const PAGE_SIZE = DEFAULT_PAGE_LIMIT;

export const RISK_LABELS: Readonly<Record<RiskLevel, string>> = {
  HIGH: 'Alto',
  ATTENTION: 'Atenção',
  OK: 'OK',
  INSUFFICIENT: 'Dados insuficientes',
};

/** A shape per level, so the badge is told apart by more than its hue (RSP-08). */
export const RISK_ICONS: Readonly<Record<RiskLevel, string>> = {
  HIGH: '▲',
  ATTENTION: '◆',
  OK: '✓',
  INSUFFICIENT: '?',
};

/** The levels in the order of the filter, worst first. */
export const RISK_LEVELS: readonly RiskLevel[] = ['HIGH', 'ATTENTION', 'OK', 'INSUFFICIENT'];

export interface TableColumn {
  column: SortColumn;
  label: string;
}

/** The columns of the table, left to right; each one sorts the page (PRO-07). */
export const TABLE_COLUMNS: readonly TableColumn[] = [
  { column: 'name', label: 'Paciente' },
  { column: 'lastReadingAt', label: 'Última leitura' },
  { column: 'timeInRangePercent', label: 'TIR' },
  { column: 'gmiPercent', label: 'GMI' },
  { column: 'cvPercent', label: 'CV' },
  { column: 'hypoEpisodes', label: 'Hipos' },
  { column: 'alertsCount', label: 'Alertas' },
  { column: 'risk', label: 'Risco' },
];

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

/** Who needs attention first: the highest risk on top. */
export const DEFAULT_SORT: SortState = { column: 'risk', direction: 'asc' };

/** A second click on a column turns its order around; a click on another starts it ascending. */
export function nextSort(current: SortState, column: SortColumn): SortState {
  if (current.column !== column) return { column, direction: 'asc' };
  return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

/** What the user chose to see of the page: a risk level (or none), a part of the name and an order. */
export interface TableView {
  risk: RiskLevel | '';
  query: string;
  sort: SortState;
}

/** The rows of the page that pass the filters, in the chosen order. */
export function visibleRows(rows: readonly PatientRow[], { risk, query, sort }: TableView): PatientRow[] {
  const filter = risk === '' ? { query } : { risk, query };
  return sortPatients(filterPatients(rows, filter), sort.column, sort.direction);
}

/** The cells between the name and the risk badge, formatted pt-BR (RSP-09). */
export function metricCells(row: PatientRow, timeZone: string): string[] {
  return [
    formatDateTime(row.lastReadingAt, timeZone),
    formatPercent(row.timeInRangePercent),
    formatPercent(row.gmiPercent),
    formatPercent(row.cvPercent),
    formatNumber(row.hypoEpisodes, 0),
    formatNumber(row.alertsCount, 0),
  ];
}

/** The page of one patient (PRO-08). */
export const patientPath = (patientId: string): string => `/profissional/pacientes/${encodeURIComponent(patientId)}`;

/** How many pages `total` patients take; at least one, so an empty list still reads "página 1 de 1". */
export const pageCount = (total: number): number => Math.max(1, Math.ceil(total / PAGE_SIZE));

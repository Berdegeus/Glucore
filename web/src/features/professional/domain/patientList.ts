// Filtering, searching and sorting of the portfolio table (PRO-06, PRO-07).
// Pure functions over rows: they run the same for the table and for its tests.

import { classifyRisk, type RiskInputs, type RiskLevel } from './risk';

/** What the list reads from a row: the identity shown, and the metrics of the period. */
export interface ListedPatient extends RiskInputs {
  /** `null` when the gateway could not name the patient; the initials stand in. */
  fullName: string | null;
  initials: string;
  lastReadingAt: string | null;
  gmiPercent: number | null;
  hypoEpisodes: number;
  alertsCount: number;
}

export interface PatientFilter {
  /** Only the patients of this risk level. */
  risk?: RiskLevel;
  /** Part of the name, ignoring case and accents; a patient with no name is found by initials. */
  query?: string;
}

export const SORT_COLUMNS = [
  'name',
  'lastReadingAt',
  'timeInRangePercent',
  'gmiPercent',
  'cvPercent',
  'hypoEpisodes',
  'alertsCount',
  'risk',
] as const;

export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDirection = 'asc' | 'desc';

/** HIGH comes first when the risk column is ascending. */
const RISK_RANK: Record<RiskLevel, number> = { HIGH: 0, ATTENTION: 1, OK: 2, INSUFFICIENT: 3 };

/** Lowercase, with the accents taken off: "João" and "joao" meet. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(row: ListedPatient, query: string): boolean {
  return fold(row.fullName ?? row.initials).includes(query);
}

/** The rows that pass every filter given, in their order. A blank query filters nothing. */
export function filterPatients<T extends ListedPatient>(rows: readonly T[], filter: PatientFilter = {}): T[] {
  const query = fold(filter.query ?? '');
  return rows.filter((row) => {
    if (filter.risk !== undefined && classifyRisk(row) !== filter.risk) return false;
    return query === '' || matchesQuery(row, query);
  });
}

type SortKey = string | number | null;

const SORT_KEYS: Record<SortColumn, (row: ListedPatient) => SortKey> = {
  name: (row) => row.fullName?.trim() || null,
  lastReadingAt: (row) => (row.lastReadingAt === null ? null : Date.parse(row.lastReadingAt)),
  timeInRangePercent: (row) => row.timeInRangePercent,
  gmiPercent: (row) => row.gmiPercent,
  cvPercent: (row) => row.cvPercent,
  hypoEpisodes: (row) => row.hypoEpisodes,
  alertsCount: (row) => row.alertsCount,
  risk: (row) => RISK_RANK[classifyRisk(row)],
};

/** Orders two keys; a missing value goes last whatever the direction, so the direction never flips it. */
function compareKeys(a: SortKey, b: SortKey, direction: SortDirection): number {
  if (a === null || b === null) return Number(a === null) - Number(b === null);
  const order =
    typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) : Number(a) - Number(b);
  return direction === 'asc' ? order : -order;
}

/**
 * A sorted copy of `rows`. Rows with nothing in the column (a patient with no
 * reading yet, no name, no TIR) stay at the end, ascending or descending, and
 * rows that tie keep their order.
 */
export function sortPatients<T extends ListedPatient>(rows: readonly T[], column: SortColumn, direction: SortDirection): T[] {
  const keyOf = SORT_KEYS[column];
  return [...rows].sort((a, b) => compareKeys(keyOf(a), keyOf(b), direction));
}

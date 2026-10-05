import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import type { DonutSlice } from '../../../../shared/presentation/charts/donutChart';
import { formatNumber } from '../../../../shared/presentation/format';
import { alertLabel, fullDay, shortDay } from '../../../patient-dashboard';
import type { AdminOverview, DayCount } from '../../domain/overview';
import { ROLE_LABELS } from './accountLabels';
import type { OverviewChartAlternative } from './defineOverviewChartWidget';

interface Named {
  label: string;
  count: number;
}

const show = (value: number): string => formatNumber(value, 0);
const sum = (entries: readonly { count: number }[]): number => entries.reduce((total, entry) => total + entry.count, 0);
const namedList = (entries: readonly Named[]): string => entries.map((entry) => `${entry.label} ${show(entry.count)}`).join('; ');

/** True when every entry is zero or there is none: the chart has nothing to draw. */
export const allZero = (entries: readonly { count: number }[]): boolean => sum(entries) === 0;

/** `Lead, 42 no total: A 1; B 2.` — the sentence for a chart of a few named values. */
function listSummary(lead: string, entries: readonly Named[]): string {
  return `${lead}, ${show(sum(entries))} no total: ${namedList(entries)}.`;
}

/** `Lead, 9 no total, de 05/08 a 06/08.` — the sentence for a chart over time; `firsts` are the `YYYY-MM-DD` of each point. */
function spanSummary(lead: string, firsts: readonly string[], counts: readonly { count: number }[]): string {
  const first = firsts[0];
  const last = firsts[firsts.length - 1];
  const span = first && last ? `, de ${shortDay(first)} a ${shortDay(last)}` : '';
  return `${lead}, ${show(sum(counts))} no total${span}.`;
}

const roleEntries = ({ accounts }: AdminOverview): Named[] => accounts.byRole.map(({ role, count }) => ({ label: ROLE_LABELS[role], count }));

export const roleSlices = (overview: AdminOverview): DonutSlice[] => roleEntries(overview).map(({ label, count }) => ({ label, value: count }));

export function roleAlternative(overview: AdminOverview): OverviewChartAlternative {
  const entries = roleEntries(overview);
  return {
    summary: listSummary('Contas por papel', entries),
    columns: ['Papel', 'Contas'],
    rows: entries.map((entry) => [entry.label, show(entry.count)]),
  };
}

/** One point per day, `05/08`, for the line charts. */
export const dayRows = (days: readonly DayCount[]): ChartRow[] => days.map(({ day, count }) => ({ day: shortDay(day), count }));

export function dayAlternative(lead: string, column: string, days: readonly DayCount[]): OverviewChartAlternative {
  return {
    summary: spanSummary(
      lead,
      days.map((entry) => entry.day),
      days,
    ),
    columns: ['Dia', column],
    rows: days.map((entry) => [fullDay(entry.day), show(entry.count)]),
  };
}

export const weekRows = ({ grants }: AdminOverview): ChartRow[] =>
  grants.createdByWeek.map(({ weekStart, count }) => ({ week: shortDay(weekStart), count }));

export function weekAlternative({ grants }: AdminOverview): OverviewChartAlternative {
  const weeks = grants.createdByWeek;
  return {
    summary: spanSummary(
      'Vínculos criados por semana',
      weeks.map((entry) => entry.weekStart),
      weeks,
    ),
    columns: ['Semana iniciada em', 'Vínculos'],
    rows: weeks.map((entry) => [fullDay(entry.weekStart), show(entry.count)]),
  };
}

const activeGroups = ({ activePatients }: AdminOverview): Named[] => [
  { label: 'Cadastrados', count: activePatients.registered },
  { label: 'Ativos 24 h', count: activePatients.last24h },
  { label: 'Ativos 7 dias', count: activePatients.last7d },
];

export const activeRows = (overview: AdminOverview): ChartRow[] => activeGroups(overview).map(({ label, count }) => ({ group: label, count }));

export function activeAlternative(overview: AdminOverview): OverviewChartAlternative {
  const groups = activeGroups(overview);
  return {
    summary: `Pacientes cadastrados e ativos: ${namedList(groups)}.`,
    columns: ['Grupo', 'Pacientes'],
    rows: groups.map((group) => [group.label, show(group.count)]),
  };
}

const alertEntries = ({ alertsByType }: AdminOverview): Named[] => alertsByType.map(({ alertType, count }) => ({ label: alertLabel(alertType), count }));

export const alertRows = (overview: AdminOverview): ChartRow[] => alertEntries(overview).map(({ label, count }) => ({ type: label, count }));

export function alertAlternative(overview: AdminOverview): OverviewChartAlternative {
  const entries = alertEntries(overview);
  return {
    summary: listSummary('Alertas da plataforma por tipo', entries),
    columns: ['Tipo', 'Alertas'],
    rows: entries.map((entry) => [entry.label, show(entry.count)]),
  };
}

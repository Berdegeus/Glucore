import { formatNumber } from '../../../../shared/presentation/format';
import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import type { AccountStatus, AdminOverview } from '../../domain/overview';
import { defineOverviewWidget } from './defineOverviewWidget';
import { ADM_KPI_ACCOUNTS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { admKpiAccountsDefinition } from './admKpiAccounts.definition';

export { ADM_KPI_ACCOUNTS_TITLE };

/** Each status as the card names it, in the order it lists them. */
const STATUS_LABELS: ReadonlyArray<readonly [AccountStatus, string]> = [
  ['ACTIVE', 'Ativas'],
  ['INACTIVE', 'Inativas'],
  ['BLOCKED', 'Bloqueadas'],
];

/** "Ativas 38 · Inativas 3 · Bloqueadas 1"; a status the API left out counts as zero. */
function statusBreakdown({ byStatus }: AdminOverview['accounts']): string {
  const countOf = (status: AccountStatus) => byStatus.find((entry) => entry.status === status)?.count ?? 0;
  return STATUS_LABELS.map(([status, label]) => `${label} ${formatNumber(countOf(status), 0)}`).join(' · ');
}

/** Every account on the platform, with how many are active, inactive and blocked (ADM-01). */
export default defineOverviewWidget({
  title: ADM_KPI_ACCOUNTS_TITLE,
  render: ({ accounts }) => <KpiCard value={accounts.total} unit="" fractionDigits={0} note={statusBreakdown(accounts)} />,
});

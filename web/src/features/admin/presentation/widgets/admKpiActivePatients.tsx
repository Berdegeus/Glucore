import { formatNumber } from '../../../../shared/presentation/format';
import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import type { AdminOverview } from '../../domain/overview';
import { defineOverviewWidget } from './defineOverviewWidget';
import { ADM_KPI_ACTIVE_PATIENTS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { admKpiActivePatientsDefinition } from './admKpiActivePatients.definition';

export { ADM_KPI_ACTIVE_PATIENTS_TITLE };

/** The unit beside the main figure: the patients with a reading in the last 24 hours. */
export const LAST_24H_UNIT = 'em 24 h';

/** "27 em 7 dias · de 35 cadastrados". */
const weekNote = ({ last7d, registered }: AdminOverview['activePatients']) =>
  `${formatNumber(last7d, 0)} em 7 dias · de ${formatNumber(registered, 0)} cadastrados`;

/** The patients whose sensor synced in the last 24 hours and 7 days, out of every patient registered (ADM-01). */
export default defineOverviewWidget({
  title: ADM_KPI_ACTIVE_PATIENTS_TITLE,
  render: ({ activePatients }) => <KpiCard value={activePatients.last24h} unit={LAST_24H_UNIT} fractionDigits={0} note={weekNote(activePatients)} />,
});

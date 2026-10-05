import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { defineOverviewWidget } from './defineOverviewWidget';
import { ADM_KPI_GRANTS_NOTE, ADM_KPI_GRANTS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { admKpiGrantsDefinition } from './admKpiGrants.definition';

export { ADM_KPI_GRANTS_NOTE, ADM_KPI_GRANTS_TITLE };

/** How many patient-to-professional links are active now, a count with no one named (ADM-01, ADM-03). */
export default defineOverviewWidget({
  title: ADM_KPI_GRANTS_TITLE,
  render: ({ grants }) => <KpiCard value={grants.active} unit="" fractionDigits={0} note={ADM_KPI_GRANTS_NOTE} />,
});

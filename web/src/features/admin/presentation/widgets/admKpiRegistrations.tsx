import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { defineOverviewWidget } from './defineOverviewWidget';
import { ADM_KPI_REGISTRATIONS_NOTE, ADM_KPI_REGISTRATIONS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { admKpiRegistrationsDefinition } from './admKpiRegistrations.definition';

export { ADM_KPI_REGISTRATIONS_NOTE, ADM_KPI_REGISTRATIONS_TITLE };

/** How many accounts were created in the page's period (ADM-01). */
export default defineOverviewWidget({
  title: ADM_KPI_REGISTRATIONS_TITLE,
  render: (overview) => <KpiCard value={overview.registrationsInPeriod} unit="" fractionDigits={0} note={ADM_KPI_REGISTRATIONS_NOTE} />,
});

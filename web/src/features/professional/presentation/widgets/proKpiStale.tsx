import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { defineCohortWidget } from './defineCohortWidget';
import { PRO_KPI_STALE_NOTE, PRO_KPI_STALE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { proKpiStaleDefinition } from './proKpiStale.definition';

export { PRO_KPI_STALE_NOTE, PRO_KPI_STALE_TITLE };

/** How many linked patients have no reading in the last 24 hours (PRO-09). */
export default defineCohortWidget({
  title: PRO_KPI_STALE_TITLE,
  render: (cohort) => <KpiCard value={cohort.patientsStale} unit="" fractionDigits={0} note={PRO_KPI_STALE_NOTE} />,
});

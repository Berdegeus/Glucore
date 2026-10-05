import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { defineCohortWidget } from './defineCohortWidget';
import { PRO_KPI_HYPO_TITLE, PRO_KPI_HYPO_NOTE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { proKpiHypoDefinition } from './proKpiHypo.definition';

export { PRO_KPI_HYPO_TITLE, PRO_KPI_HYPO_NOTE };

/** How many linked patients had a hypoglycemia episode in the period (PRO-09). */
export default defineCohortWidget({
  title: PRO_KPI_HYPO_TITLE,
  render: (cohort) => <KpiCard value={cohort.patientsWithHypo} unit="" fractionDigits={0} note={PRO_KPI_HYPO_NOTE} />,
});

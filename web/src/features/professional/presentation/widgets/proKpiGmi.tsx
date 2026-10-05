import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { defineCohortWidget } from './defineCohortWidget';
import { PRO_KPI_GMI_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { proKpiGmiDefinition } from './proKpiGmi.definition';

export { PRO_KPI_GMI_TITLE };

/** The average GMI of the linked patients over the period, in percent (PRO-09). */
export default defineCohortWidget({
  title: PRO_KPI_GMI_TITLE,
  render: (cohort) => <KpiCard value={cohort.avgGmiPercent} unit="%" />,
});

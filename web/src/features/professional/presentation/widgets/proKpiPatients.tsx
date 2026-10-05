import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { defineCohortWidget } from './defineCohortWidget';
import { PRO_KPI_PATIENTS_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { proKpiPatientsDefinition } from './proKpiPatients.definition';

export { PRO_KPI_PATIENTS_TITLE };

/** How many patients the professional follows, from the cohort of the period (PRO-09). */
export default defineCohortWidget({
  title: PRO_KPI_PATIENTS_TITLE,
  render: (cohort) => <KpiCard value={cohort.patientCount} unit="" fractionDigits={0} />,
});

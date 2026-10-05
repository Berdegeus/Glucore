import { KpiCard, type KpiTarget } from '../../../../shared/presentation/ui/kpiCard';
import { defineCohortWidget } from './defineCohortWidget';
import { PRO_KPI_TIR_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its card code.
export { proKpiTirDefinition } from './proKpiTir.definition';

export { PRO_KPI_TIR_TITLE };

/** The goal of the portfolio's average time in range: at least 70 % (PRO-09), the one the patient side uses. */
export const COHORT_TIR_GOAL: KpiTarget = { kind: 'atLeast', value: 70, unit: '%' };

/** The average time in range of the linked patients over the period, against the 70 % goal (PRO-09). */
export default defineCohortWidget({
  title: PRO_KPI_TIR_TITLE,
  render: (cohort) => <KpiCard value={cohort.avgTimeInRangePercent} unit="%" target={COHORT_TIR_GOAL} />,
});

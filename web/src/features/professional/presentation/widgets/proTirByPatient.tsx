import { StackedBarChart } from '../../../../shared/presentation/charts/stackedBarChart';
import { formatPercent } from '../../../../shared/presentation/format';
import { defineCohortChartWidget } from './defineCohortWidget';
import { chartHeightFor, shortLabel, tirByPatientAlternative, tirByPatientRows, ZONE_SEGMENTS } from './tirByPatientModel';
import { PRO_TIR_BY_PATIENT_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { proTirByPatientDefinition } from './proTirByPatient.definition';

export { PRO_TIR_BY_PATIENT_TITLE };

const PERCENT_DOMAIN = [0, 100] as const;
const formatTick = (value: number) => formatPercent(value, 0);

/** The share of readings in each of the five zones, one horizontal stacked bar per linked patient (PRO-10). */
export default defineCohortChartWidget({
  title: PRO_TIR_BY_PATIENT_TITLE,
  alternative: tirByPatientAlternative,
  chart: (cohort) => (
    <StackedBarChart
      data={tirByPatientRows(cohort.perPatient)}
      categoryKey="patient"
      segments={ZONE_SEGMENTS}
      orientation="horizontal"
      domain={PERCENT_DOMAIN}
      height={chartHeightFor(cohort.perPatient.length)}
      formatCategory={shortLabel}
      formatValue={formatTick}
    />
  ),
});

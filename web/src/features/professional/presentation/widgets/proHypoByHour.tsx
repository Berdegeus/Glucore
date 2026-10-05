import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatNumber } from '../../../../shared/presentation/format';
import { defineCohortChartWidget } from './defineCohortWidget';
import { hypoByHourAlternative, hypoByHourRows } from './hypoByHourModel';
import { PRO_HYPO_BY_HOUR_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { proHypoByHourDefinition } from './proHypoByHour.definition';

export { PRO_HYPO_BY_HOUR_TITLE };

const SERIES = [{ key: 'count', label: 'Episódios' }];
const formatCount = (value: number) => formatNumber(value, 0);

/** Hypoglycemia episodes of every linked patient by hour of the day, 0 to 23 (PRO-10). */
export default defineCohortChartWidget({
  title: PRO_HYPO_BY_HOUR_TITLE,
  alternative: hypoByHourAlternative,
  chart: (cohort) => <BarChart data={hypoByHourRows(cohort)} categoryKey="hour" series={SERIES} formatValue={formatCount} />,
});

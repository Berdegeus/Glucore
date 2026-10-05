import { BarChart } from '../../../../shared/presentation/charts/barChart';
import { formatNumber } from '../../../../shared/presentation/format';
import { defineCohortChartWidget } from './defineCohortWidget';
import { tirHistogramAlternative, tirHistogramRows } from './tirHistogramModel';
import { PRO_TIR_HISTOGRAM_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { proTirHistogramDefinition } from './proTirHistogram.definition';

export { PRO_TIR_HISTOGRAM_TITLE };

const SERIES = [{ key: 'count', label: 'Pacientes' }];
const formatCount = (value: number) => formatNumber(value, 0);

/** How many linked patients fall below 50 %, from 50 to 70 % and at 70 % or more time in range (PRO-10). */
export default defineCohortChartWidget({
  title: PRO_TIR_HISTOGRAM_TITLE,
  alternative: tirHistogramAlternative,
  chart: (cohort) => <BarChart data={tirHistogramRows(cohort)} categoryKey="band" series={SERIES} formatValue={formatCount} />,
});

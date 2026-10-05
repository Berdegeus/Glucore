import { KpiCard, type KpiTarget } from '../../../../shared/presentation/ui/kpiCard';
import { defineSummaryWidget } from './defineSummaryWidget';
import { KPI_CV_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { kpiCvDefinition } from './kpiCv.definition';

export { KPI_CV_TITLE };

/** A coefficient of variation up to 36 % counts as stable glucose (PAC-05). */
export const CV_TARGET: KpiTarget = { kind: 'atMost', value: 36, unit: '%' };

/** Coefficient of variation of the period, in percent, against the 36 % ceiling. */
export default defineSummaryWidget({
  title: KPI_CV_TITLE,
  isEmpty: (summary) => summary.coefficientOfVariationPercent === null,
  render: (summary) => <KpiCard value={summary.coefficientOfVariationPercent} unit="%" target={CV_TARGET} />,
});

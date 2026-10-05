import { KpiCard, type KpiTarget } from '../../../../shared/presentation/ui/kpiCard';
import { defineSummaryWidget } from './defineSummaryWidget';
import { KPI_TIR_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { kpiTirDefinition } from './kpiTir.definition';

export { KPI_TIR_TITLE };

/** At least 70 % of the readings inside the target range (PAC-05). */
export const TIR_TARGET: KpiTarget = { kind: 'atLeast', value: 70, unit: '%' };

/** Time in range of the period, in percent, against the 70 % goal. */
export default defineSummaryWidget({
  title: KPI_TIR_TITLE,
  isEmpty: (summary) => summary.timeInRangePercent === null,
  render: (summary) => <KpiCard value={summary.timeInRangePercent} unit="%" target={TIR_TARGET} />,
});

import { KpiCard, type KpiTarget } from '../../../../shared/presentation/ui/kpiCard';
import type { WidgetProps } from '../../../dashboard-layout';
import { SummaryWidget } from './summaryWidget';
import { KPI_CV_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { kpiCvDefinition } from './kpiCv.definition';

export { KPI_CV_TITLE };

/** A coefficient of variation up to 36 % counts as stable glucose (PAC-05). */
export const CV_TARGET: KpiTarget = { kind: 'atMost', value: 36, unit: '%' };

/** Coefficient of variation of the period, in percent, against the 36 % ceiling. */
export default function KpiCv({ size }: WidgetProps) {
  return (
    <SummaryWidget title={KPI_CV_TITLE} size={size} isEmpty={(summary) => summary.coefficientOfVariationPercent === null}>
      {(summary) => <KpiCard value={summary.coefficientOfVariationPercent} unit="%" target={CV_TARGET} />}
    </SummaryWidget>
  );
}

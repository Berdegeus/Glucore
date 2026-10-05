import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import type { WidgetProps } from '../../../dashboard-layout';
import { hasEnoughDaysForGmi } from '../../domain/metrics';
import { SummaryWidget } from './summaryWidget';
import { KPI_GMI_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { kpiGmiDefinition } from './kpiGmi.definition';

export { KPI_GMI_TITLE };

/** Shown under a GMI that rests on fewer than 14 days with readings (PAC-05). */
export const FEW_DAYS_NOTE = 'Poucos dados no período';

/** The glucose management indicator of the period, in percent, with a warning when the period is too thin for it. */
export default function KpiGmi({ size }: WidgetProps) {
  return (
    <SummaryWidget title={KPI_GMI_TITLE} size={size} isEmpty={(summary) => summary.gmiPercent === null}>
      {(summary) => (
        <KpiCard value={summary.gmiPercent} unit="%" note={hasEnoughDaysForGmi(summary.byDay) ? undefined : FEW_DAYS_NOTE} />
      )}
    </SummaryWidget>
  );
}

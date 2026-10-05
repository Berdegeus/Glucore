import { KpiCard, type KpiTarget } from '../../../../shared/presentation/ui/kpiCard';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { SummaryWidget } from './summaryWidget';

export const KPI_TIR_TITLE = 'Tempo no alvo';

/** At least 70 % of the readings inside the target range (PAC-05). */
export const TIR_TARGET: KpiTarget = { kind: 'atLeast', value: 70, unit: '%' };

export const kpiTirDefinition: WidgetDefinition = {
  id: 'kpi-tir',
  titleKey: 'widget.kpi-tir',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

/** Time in range of the period, in percent, against the 70 % goal. */
export default function KpiTir({ size }: WidgetProps) {
  return (
    <SummaryWidget title={KPI_TIR_TITLE} size={size} isEmpty={(summary) => summary.timeInRangePercent === null}>
      {(summary) => <KpiCard value={summary.timeInRangePercent} unit="%" target={TIR_TARGET} />}
    </SummaryWidget>
  );
}

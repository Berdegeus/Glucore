import { KpiCard } from '../../../../shared/presentation/ui/kpiCard';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { weightedMean } from '../../domain/metrics';
import { SummaryWidget } from './summaryWidget';

export const KPI_MEAN_TITLE = 'Glicose média';

export const kpiMeanDefinition: WidgetDefinition = {
  id: 'kpi-mean',
  titleKey: 'widget.kpi-mean',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

/** Mean glucose of the period in whole mg/dL, each day weighted by its readings (PAC-05). */
export default function KpiMean({ size }: WidgetProps) {
  return (
    <SummaryWidget title={KPI_MEAN_TITLE} size={size} isEmpty={(summary) => weightedMean(summary.byDay) === null}>
      {(summary) => <KpiCard value={weightedMean(summary.byDay)} unit="mg/dL" fractionDigits={0} />}
    </SummaryWidget>
  );
}

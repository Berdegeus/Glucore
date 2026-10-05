import { KpiCard, type KpiTarget } from '../../../../shared/presentation/ui/kpiCard';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { SummaryWidget } from './summaryWidget';

export const KPI_SENSOR_USE_TITLE = 'Uso do sensor';

/** Wearing the sensor for at least 70 % of the period (PAC-05). */
export const SENSOR_USE_TARGET: KpiTarget = { kind: 'atLeast', value: 70, unit: '%' };

export const kpiSensorUseDefinition: WidgetDefinition = {
  id: 'kpi-sensor-use',
  titleKey: 'widget.kpi-sensor-use',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

/**
 * Share of the period the sensor delivered readings, in percent (API-04),
 * against the 70 % goal. The API answers 0 when there is nothing, so the
 * empty state keys on the reading count instead.
 */
export default function KpiSensorUse({ size }: WidgetProps) {
  return (
    <SummaryWidget title={KPI_SENSOR_USE_TITLE} size={size} isEmpty={(summary) => summary.totals.readingsCount === 0}>
      {(summary) => <KpiCard value={summary.sensorUsePercent} unit="%" target={SENSOR_USE_TARGET} />}
    </SummaryWidget>
  );
}

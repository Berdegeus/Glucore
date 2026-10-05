import { KpiCard, type KpiTarget } from '../../../../shared/presentation/ui/kpiCard';
import type { WidgetProps } from '../../../dashboard-layout';
import { SummaryWidget } from './summaryWidget';
import { KPI_SENSOR_USE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { kpiSensorUseDefinition } from './kpiSensorUse.definition';

export { KPI_SENSOR_USE_TITLE };

/** Wearing the sensor for at least 70 % of the period (PAC-05). */
export const SENSOR_USE_TARGET: KpiTarget = { kind: 'atLeast', value: 70, unit: '%' };

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

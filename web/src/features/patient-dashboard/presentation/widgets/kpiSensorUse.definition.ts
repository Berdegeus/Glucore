import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const kpiSensorUseDefinition: WidgetDefinition = {
  id: 'kpi-sensor-use',
  titleKey: 'widget.kpi-sensor-use',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

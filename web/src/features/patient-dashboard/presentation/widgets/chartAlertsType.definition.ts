import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartAlertsTypeDefinition: WidgetDefinition = {
  id: 'chart-alerts-type',
  titleKey: 'widget.chart-alerts-type',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

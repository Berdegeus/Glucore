import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartZonesDefinition: WidgetDefinition = {
  id: 'chart-zones',
  titleKey: 'widget.chart-zones',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

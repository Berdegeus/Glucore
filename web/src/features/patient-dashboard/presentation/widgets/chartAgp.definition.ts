import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartAgpDefinition: WidgetDefinition = {
  id: 'chart-agp',
  titleKey: 'widget.chart-agp',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

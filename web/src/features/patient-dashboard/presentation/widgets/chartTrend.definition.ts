import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartTrendDefinition: WidgetDefinition = {
  id: 'chart-trend',
  titleKey: 'widget.chart-trend',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

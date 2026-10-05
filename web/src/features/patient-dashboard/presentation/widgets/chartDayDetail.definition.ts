import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartDayDetailDefinition: WidgetDefinition = {
  id: 'chart-day-detail',
  titleKey: 'widget.chart-day-detail',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

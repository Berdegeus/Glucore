import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartDailyTirDefinition: WidgetDefinition = {
  id: 'chart-daily-tir',
  titleKey: 'widget.chart-daily-tir',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

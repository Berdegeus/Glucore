import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartInsulinTypeDefinition: WidgetDefinition = {
  id: 'chart-insulin-type',
  titleKey: 'widget.chart-insulin-type',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartCarbsInsulinDefinition: WidgetDefinition = {
  id: 'chart-carbs-insulin',
  titleKey: 'widget.chart-carbs-insulin',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

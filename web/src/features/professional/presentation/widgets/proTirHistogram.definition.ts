import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proTirHistogramDefinition: WidgetDefinition = {
  id: 'pro-tir-histogram',
  titleKey: 'widget.pro-tir-histogram',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

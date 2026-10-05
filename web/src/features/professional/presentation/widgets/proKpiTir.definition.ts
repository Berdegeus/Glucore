import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proKpiTirDefinition: WidgetDefinition = {
  id: 'pro-kpi-tir',
  titleKey: 'widget.pro-kpi-tir',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};
